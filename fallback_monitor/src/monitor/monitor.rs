// This file is part of Avail Gas Relay Service.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/// This file contains logic to monitor the failing transactions.
/// If there are failed transactions it picks them and tries to resubmit it
/// If successful updates the state of the data to "Resolved".
use crate::{
    config::AppConfig,
    db::{customer_expenditure::get_unresolved_transactions, users::get_app_id},
};
use avail_rust::{Keypair, SDK};
use bigdecimal::BigDecimal;
use db::{
    models::customer_expenditure::CustomerExpenditureGetWithPayload, schema::token_balances::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::{error, info};
use reqwest::Client;
use std::str::FromStr;
use turbo_da_core::{
    avail::submit_data::SubmitDataAvail,
    db::customer_expenditure::update_customer_expenditure,
    utils::{get_prices, TOKEN_MAP},
};

/// Monitors and processes failed transactions from the database
///
/// # Arguments
/// * `connection` - Database connection handle
/// * `config` - Application configuration
/// * `client` - Avail SDK client instance
/// * `account` - Keypair for transaction signing
///
/// # Description
/// Fetches unresolved transactions from the database and processes them
/// by attempting to resubmit them to the Avail network
pub async fn monitor_failed_transactions(
    connection: &mut AsyncPgConnection,
    config: &AppConfig,
    client: &SDK,
    account: &Keypair,
) {
    let unresolved_transactions = get_unresolved_transactions(connection).await;

    match unresolved_transactions {
        Ok(failed_transactions_list) => {
            process_failed_transactions(
                connection,
                config,
                client,
                account,
                failed_transactions_list,
            )
            .await;
        }
        Err(_) => {
            error!("Couldn't fetch unresolved transactions from db")
        }
    }
}

/// Processes a list of failed transactions by attempting to resubmit them
///
/// # Arguments
/// * `connection` - Database connection handle
/// * `config` - Application configuration
/// * `client` - Avail SDK client instance
/// * `account` - Keypair for transaction signing
/// * `failed_transactions_list` - List of failed transactions to process
///
/// # Description
/// For each failed transaction:
/// 1. Retrieves the associated app ID
/// 2. Attempts to resubmit the transaction data
/// 3. If successful, calculates fees and updates the transaction status
async fn process_failed_transactions(
    connection: &mut AsyncPgConnection,
    config: &AppConfig,
    client: &SDK,
    account: &Keypair,
    failed_transactions_list: Vec<CustomerExpenditureGetWithPayload>,
) {
    for i in failed_transactions_list {
        info!("Processing failed transaction submission id: {:?} ", i.id);
        let Some(data) = i.payload else {
            error!("No payload found for transaction id: {:?}", i.id);
            continue;
        };
        let avail_app_id = match get_app_id(connection, &i.user_id).await {
            Ok(app) => app,
            Err(e) => {
                error!("Couldn't fetch app id. Error: {:?}", e);
                return;
            }
        };

        let token_details = match token_balances
            .filter(db::schema::token_balances::token_details_id.eq(i.token_details_id))
            .select(db::models::token_balances::TokenBalances::as_select())
            .first::<db::models::token_balances::TokenBalances>(connection)
            .await
        {
            Ok(details) => details,
            Err(e) => {
                error!("Failed to get token details: {:?}", e);
                continue;
            }
        };

        let reqwest_client = Client::new();

        let Ok((coin_price, avail_price)) = get_prices(
            &reqwest_client,
            &config.coingecko_api_url,
            &config.coingecko_api_key,
            &i.payment_token,
        )
        .await
        else {
            error!("Failed to get prices");
            continue;
        };

        let token_balance_in_avail = get_token_price_equivalent_to_avail(
            &BigDecimal::from(&token_details.token_balance - token_details.token_used),
            &i.payment_token,
            &avail_price,
            &coin_price,
        );

        info!("Token balance in Avail: {}", token_balance_in_avail);

        if token_balance_in_avail > one_avail() {
            info!(
                "Balance is sufficient for user_id {}, balance: {}",
                i.user_id, token_balance_in_avail
            );
        } else {
            error!("Insufficient balance: {}", token_balance_in_avail);
            continue;
        }

        let submit_data_class = SubmitDataAvail::new(client, account, avail_app_id);
        let submission = submit_data_class.submit_data(&data).await;

        match submission {
            Ok(success) => {
                let fees_as_bigdecimal = BigDecimal::from(&success.gas_fee);
                info!("Fees as BigDecimal: {}", fees_as_bigdecimal);

                let fees_as_bigdecimal_in_avail = get_token_price_equivalent_to_avail(
                    &fees_as_bigdecimal,
                    &i.payment_token,
                    &avail_price,
                    &coin_price,
                );

                update_customer_expenditure(
                    success,
                    &fees_as_bigdecimal,
                    &fees_as_bigdecimal_in_avail,
                    i.id,
                    connection,
                )
                .await;
            }
            Err(e) => {
                error!("Tx submission failed again: id {:?}", e);
            }
        }
    }
}

/// Calculates the equivalent price in AVAIL tokens for a given amount of another token
///
/// # Arguments
/// * `client` - HTTP client for making API requests
/// * `config` - Application configuration containing API endpoints
/// * `amount` - Amount to convert
/// * `token_name` - Name of the token to convert from
///
/// # Returns
/// * `Result<BigDecimal, String>` - The equivalent amount in AVAIL tokens, rounded to 0 decimal places
///
/// # Description
/// Fetches current prices from Coingecko API and performs conversion calculations
/// taking into account different token decimal places
pub fn get_token_price_equivalent_to_avail(
    amount: &BigDecimal,
    token_name: &String,
    avail_price: &f64,
    coin_price: &f64,
) -> BigDecimal {
    let decimals_token = TOKEN_MAP.get(token_name).unwrap().token_decimals;
    let decimals_avail = TOKEN_MAP.get("avail").unwrap().token_decimals;

    let avail_price_per_token = avail_price / coin_price;
    let avail_price_per_token_bigdecimal =
        match BigDecimal::from_str(&avail_price_per_token.to_string()) {
            Ok(amount) => amount,
            Err(e) => {
                error!("Failed to parse amount to BigDecimal: {}", e);
                return BigDecimal::from(0);
            }
        };

    let price = avail_price_per_token_bigdecimal
        * amount
        * BigDecimal::from(10_u64.pow(decimals_token as u32))
        / BigDecimal::from(10_u64.pow(decimals_avail as u32));

    price.round(0)
}

fn one_avail() -> BigDecimal {
    BigDecimal::from(10u64.pow(TOKEN_MAP.get("avail").unwrap().token_decimals as u32))
}

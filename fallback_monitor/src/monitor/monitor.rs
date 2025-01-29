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
    models::{customer_expenditure::CustomerExpenditureGetWithPayload, user_model::User},
    schema::users::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::{error, info};
use turbo_da_core::{
    avail::submit_data::SubmitDataAvail,
    db::customer_expenditure::update_customer_expenditure,
    utils::{get_prices, Convertor, TOKEN_MAP},
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

        let credit_details = match users
            .filter(db::schema::users::id.eq(i.user_id))
            .select(User::as_select())
            .first::<User>(connection)
            .await
        {
            Ok(details) => details,
            Err(e) => {
                error!("Failed to get token details: {:?}", e);
                continue;
            }
        };

        let convertor = Convertor::new(&client, &account);
        let credits_used = convertor.calculate_credit_utlisation(data.to_vec()).await;

        if credits_used > credit_details.credit_balance {
            error!("Insufficient credits for user id: {:?}", i.id);
            continue;
        }
        let submit_data_class = SubmitDataAvail::new(client, account, avail_app_id);
        let submission = submit_data_class.submit_data(&data).await;

        match submission {
            Ok(success) => {
                let fees_as_bigdecimal = BigDecimal::from(&success.gas_fee);

                update_customer_expenditure(
                    success,
                    &fees_as_bigdecimal,
                    &credits_used,
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

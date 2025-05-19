use avail_rust::{Keypair, SDK};
use avail_utils::submit_data::SubmitDataAvail;
use bigdecimal::BigDecimal;
/// This file contains logic to monitor the failing transactions.
/// If there are failed transactions it picks them and tries to resubmit it
/// If successful updates the state of the data to "Resolved".
use db::{
    controllers::{
        customer_expenditure::increase_retry_count,
        misc::{get_unresolved_transactions, update_credit_balance},
    },
    models::apps::Apps,
};
use db::{
    controllers::{customer_expenditure::update_customer_expenditure, users::TxParams},
    models::{customer_expenditure::CustomerExpenditureGetWithPayload, user_model::User},
};

use diesel_async::AsyncPgConnection;
use log::{error, info};
use observability::{log_fallback_txn_error, log_retry_count};
use turbo_da_core::utils::{format_size, Convertor};

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
    client: &SDK,
    account: &Keypair,
    retry_count: i32,
    limit: i64,
) {
    let unresolved_transactions = get_unresolved_transactions(connection, retry_count, limit).await;

    match unresolved_transactions {
        Ok(failed_transactions_list) => {
            process_failed_transactions(
                connection,
                client,
                account,
                retry_count,
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
    client: &SDK,
    account: &Keypair,
    retry_count: i32,
    failed_transactions_list: Vec<(CustomerExpenditureGetWithPayload, Apps, User)>,
) {
    for (customer_expenditure_details, account_details, user_details) in failed_transactions_list {
        info!(
            "Processing failed transaction submission id: {:?} ",
            customer_expenditure_details.id
        );
        let result = increase_retry_count(customer_expenditure_details.id, connection).await;
        if result.is_err() {
            log_error(
                &customer_expenditure_details.id.to_string(),
                "Failed to increase retry count",
            );
            continue;
        }

        log_retry_count(
            &customer_expenditure_details.id.to_string(),
            customer_expenditure_details.retry_count as usize,
        );

        if customer_expenditure_details.retry_count > retry_count {
            log_error(
                &customer_expenditure_details.id.to_string(),
                "Retry count exceeded",
            );
            continue;
        }
        let Some(data) = customer_expenditure_details.payload else {
            log_error(
                &customer_expenditure_details.id.to_string(),
                "No payload found for transaction id",
            );
            continue;
        };

        let convertor = Convertor::new(client, account);
        let credits_used = convertor.calculate_credit_utlisation(data.to_vec()).await;

        if credits_used >= account_details.credit_balance {
            if !account_details.fallback_enabled
                || &credits_used - &account_details.credit_balance >= user_details.credit_balance
            {
                log_error(
                    &customer_expenditure_details.id.to_string(),
                    "Insufficient credits for user id",
                );
                continue;
            }
        }

        let submit_data_class = SubmitDataAvail::new(client, account, account_details.app_id);
        let submission = submit_data_class.submit_data(&data).await;

        match submission {
            Ok(success) => {
                let fees_as_bigdecimal = BigDecimal::from(&success.gas_fee);

                let tx_params = TxParams {
                    amount_data: format_size(data.len()),
                    amount_data_billed: credits_used,
                    fees: success.gas_fee,
                };
                let result = update_customer_expenditure(
                    success,
                    &fees_as_bigdecimal,
                    &tx_params.amount_data_billed,
                    customer_expenditure_details.id,
                    connection,
                )
                .await;
                if result.is_err() {
                    log_error(
                        &customer_expenditure_details.id.to_string(),
                        "Failed to update customer expenditure",
                    );
                }
                let result = update_credit_balance(connection, &account_details, &tx_params).await;
                if result.is_err() {
                    log_error(
                        &customer_expenditure_details.id.to_string(),
                        "Failed to update credit balance",
                    );
                    continue;
                }
            }
            Err(e) => {
                log_error(&customer_expenditure_details.id.to_string(), &e);
            }
        }
    }
}

fn log_error(id: &str, message: &str) {
    error!(
        "Fallback transaction error: id {:?}, message: {:?}",
        id, message
    );
    log_fallback_txn_error(id, message);
}

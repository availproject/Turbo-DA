/// This file contains logic to monitor the failing transactions.
/// If there are failed transactions it picks them and tries to resubmit it
/// If successful updates the state of the data to "Resolved".
use crate::db::{
    customer_expenditure::{get_unresolved_transactions, increase_retry_count},
    users::get_app_id,
};
use avail_rust::{Keypair, SDK};
use bigdecimal::BigDecimal;
use data_submission::{
    avail::submit_data::SubmitDataAvail,
    db::{
        customer_expenditure::update_customer_expenditure,
        users::{update_credit_balance, TxParams},
    },
};
use db::{
    models::{customer_expenditure::CustomerExpenditureGetWithPayload, user_model::User},
    schema::users::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
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
) {
    let unresolved_transactions = get_unresolved_transactions(connection, retry_count).await;

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
    failed_transactions_list: Vec<CustomerExpenditureGetWithPayload>,
) {
    for i in failed_transactions_list {
        info!("Processing failed transaction submission id: {:?} ", i.id);
        let result = increase_retry_count(i.id, connection).await;
        if result.is_err() {
            log_fallback_txn_error(
                &i.id.to_string(),
                "Failed to increase retry count for entry id",
            );
            error!("Failed to increase retry count for entry id: {:?}", i.id);
            continue;
        }

        log_retry_count(&i.id.to_string(), i.retry_count as usize);

        if i.retry_count > retry_count {
            log_fallback_txn_error(&i.id.to_string(), "Retry count exceeded for transaction id");
            error!("Retry count exceeded for transaction id: {:?}", i.id);
            continue;
        }
        let Some(data) = i.payload else {
            log_fallback_txn_error(&i.id.to_string(), "No payload found for transaction id");
            error!("No payload found for transaction id: {:?}", i.id);
            continue;
        };
        let avail_app_id = match get_app_id(connection, &i.user_id).await {
            Ok(app) => app,
            Err(e) => {
                log_fallback_txn_error(&i.id.to_string(), &e);
                error!("Couldn't fetch app id. Error: {:?}", e);
                return;
            }
        };

        let credit_details = match users
            .filter(db::schema::users::id.eq(&i.user_id))
            .select(User::as_select())
            .first::<User>(connection)
            .await
        {
            Ok(details) => details,
            Err(e) => {
                log_fallback_txn_error(&i.id.to_string(), &format!("{:?}", e));
                error!("Failed to get token details: {:?}", e);
                continue;
            }
        };

        let convertor = Convertor::new(client, account);
        let credits_used = convertor.calculate_credit_utlisation(data.to_vec()).await;

        if credits_used > credit_details.credit_balance {
            log_fallback_txn_error(&i.id.to_string(), "Insufficient credits for user id");
            error!("Insufficient credits for user id: {:?}", i.id);
            continue;
        }
        let submit_data_class = SubmitDataAvail::new(client, account, avail_app_id);
        let submission = submit_data_class.submit_data(&data).await;

        match submission {
            Ok(success) => {
                let fees_as_bigdecimal = BigDecimal::from(&success.gas_fee);

                let tx_params = TxParams {
                    amount_data: format_size(data.len()),
                    amount_data_billed: credits_used,
                    fees: success.gas_fee,
                };
                update_customer_expenditure(
                    success,
                    &fees_as_bigdecimal,
                    &tx_params.amount_data_billed,
                    i.id,
                    connection,
                )
                .await;
                update_credit_balance(connection, &i.user_id, &tx_params).await;
            }
            Err(e) => {
                log_fallback_txn_error(&i.id.to_string(), &e);
                error!("Tx submission failed again: id {:?}", e);
            }
        }
    }
}

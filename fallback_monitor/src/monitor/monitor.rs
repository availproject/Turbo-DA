use std::sync::Arc;

use avail_rust::{Client, Keypair};
use avail_utils::submit_data::SubmitDataAvail;
use data_submission::{ProcessSubmitResponse, Response};
use db::models::{customer_expenditure::CustomerExpenditureGetWithPayload, user_model::User};
/// This file contains logic to monitor the failing transactions.
/// If there are failed transactions it picks them and tries to resubmit it
/// If successful updates the state of the data to "Resolved".
use db::{
    controllers::{customer_expenditure::increase_retry_count, misc::get_unresolved_transactions},
    models::apps::Apps,
};

use data_submission::redis::Redis;
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncConnection, AsyncPgConnection,
};
use enigma::EnigmaEncryptionService;
use observability::{log_fallback_txn_error, log_retry_count};
use turbo_da_core::logger::{error, info};

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
    connection: &String,
    client: &Client,
    account: &Vec<Keypair>,
    redis: Arc<Redis>,
    retry_count: i32,
    limit: i64,
    enigma: &EnigmaEncryptionService,
) {
    let mut connection_client = AsyncPgConnection::establish(connection)
        .await
        .expect("Failed to connect to db");
    let unresolved_transactions =
        get_unresolved_transactions(&mut connection_client, retry_count, limit).await;

    match unresolved_transactions {
        Ok(failed_transactions_list) => {
            if failed_transactions_list.is_empty() {
                info(&format!("No unresolved transactions found"));
                return;
            }
            process_failed_transactions(
                connection,
                client,
                redis,
                account,
                retry_count,
                failed_transactions_list,
                enigma,
            )
            .await;
        }
        Err(e) => {
            error(&format!("Couldn't fetch unresolved transactions from db: {}", e));
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
    connection: &String,
    client: &Client,
    redis: Arc<Redis>,
    account: &Vec<Keypair>,
    retry_count: i32,
    failed_transactions_list: Vec<(CustomerExpenditureGetWithPayload, Apps, User)>,
    enigma: &EnigmaEncryptionService,
) {
    let db_config = AsyncDieselConnectionManager::<AsyncPgConnection>::new(connection);

    let pool: Pool<AsyncPgConnection> = Pool::builder(db_config)
        .max_size(failed_transactions_list.len())
        .build()
        .expect("Failed to create pool");

    let pool_ref = &pool;

    let futures = failed_transactions_list.into_iter().enumerate().map(
        |(index, (customer_expenditure_details, account_details, _))| {
            let redis = Arc::clone(&redis);
            async move {
                let mut connection = pool_ref.get().await.unwrap();
                info(&format!(
                    "Processing failed transaction submission id: {:?} ",
                    customer_expenditure_details.id
                ));
                let result =
                    increase_retry_count(customer_expenditure_details.id, &mut connection).await;
                if result.is_err() {
                    log_error(
                        &customer_expenditure_details.id.to_string(),
                        "Failed to increase retry count",
                    );
                    return;
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
                    return;
                }

                let Some(data) = customer_expenditure_details.payload else {
                    log_error(
                        &customer_expenditure_details.id.to_string(),
                        "No payload found for transaction id",
                    );
                    return;
                };

                let submit_data_class =
                    SubmitDataAvail::new(&client, &account[index], account_details.app_id);

                let response = Response {
                    raw_payload: data.into(),
                    submission_id: customer_expenditure_details.id,
                    thread_id: 0,
                    app_id: account_details.id,
                    avail_app_id: account_details.app_id,
                };

                let mut process_response = ProcessSubmitResponse::new(
                    &response,
                    &mut connection,
                    submit_data_class,
                    enigma,
                    redis,
                );

                let result = process_response.process_response().await;
                match result {
                    Ok(_) => {
                        info(&format!(
                            "Successfully processed response for submission id: {:?}",
                            customer_expenditure_details.id
                        ));
                    }
                    Err(e) => {
                        log_error(&customer_expenditure_details.id.to_string(), &e);
                    }
                }
            }
        },
    );

    futures::future::join_all(futures).await;
}

fn log_error(id: &str, message: &str) {
    error(&format!(
        "Fallback transaction error: id {:?}, message: {:?}",
        id, message
    ));
    log_fallback_txn_error(id, message);
}

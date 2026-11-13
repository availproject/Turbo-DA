use std::sync::Arc;

use avail_rust::Keypair;
use avail_utils::{normal, submit_data::SubmitDataAvail};
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
    pooled_connection::deadpool::Pool,
    AsyncPgConnection,
};
use enigma::EnigmaEncryptionService;
use observability::{log_fallback_txn_error, log_retry_count};
use turbo_da_core::utils::{generate_avail_sdk, generate_normal_avail_sdk};

/// Connection details for the networks a failed submission can be retried on.
pub struct Networks {
    pub normal_endpoints: Arc<Vec<String>>,
    pub infinity_endpoints: Arc<Vec<String>>,
    pub normal_keypairs: Vec<normal::Keypair>,
    pub infinity_keypairs: Vec<Keypair>,
}

impl Networks {
    fn is_configured(&self, infinity: bool) -> bool {
        if infinity {
            !self.infinity_endpoints.is_empty()
        } else {
            !self.normal_endpoints.is_empty()
        }
    }
}

/// Monitors and processes failed transactions from the database
///
/// # Arguments
/// * `connection` - Database connection handle
/// * `config` - Application configuration
/// * `networks` - Endpoints and keypairs for each network
///
/// # Description
/// Fetches unresolved transactions from the database and processes them
/// by attempting to resubmit them to the Avail network
pub async fn monitor_failed_transactions(
    connection: &String,
    networks: &Networks,
    redis: Arc<Redis>,
    retry_count: i32,
    limit: i64,
    enigma: &EnigmaEncryptionService,
) {
    let mut connection_client = db::establish(connection)
        .await
        .expect("Failed to connect to db");
    let unresolved_transactions =
        get_unresolved_transactions(&mut connection_client, retry_count, limit).await;

    match unresolved_transactions {
        Ok(mut failed_transactions_list) => {
            failed_transactions_list.retain(|(transaction, _, _)| {
                let configured = networks.is_configured(transaction.infinity);
                if !configured {
                    log_error(&transaction.id.to_string(), "Network is not configured");
                }
                configured
            });

            if failed_transactions_list.is_empty() {
                tracing::info!("no unresolved transactions found");
                return;
            }
            process_failed_transactions(
                connection,
                networks,
                redis,
                retry_count,
                failed_transactions_list,
                enigma,
            )
            .await;
        }
        Err(e) => {
            tracing::error!(error = %e, "couldn't fetch unresolved transactions from db");
        }
    }
}

/// Processes a list of failed transactions by attempting to resubmit them
///
/// # Arguments
/// * `connection` - Database connection handle
/// * `config` - Application configuration
/// * `networks` - Endpoints and keypairs for each network
/// * `failed_transactions_list` - List of failed transactions to process
///
/// # Description
/// For each failed transaction:
/// 1. Retrieves the associated app ID
/// 2. Attempts to resubmit the transaction data
/// 3. If successful, calculates fees and updates the transaction status
async fn process_failed_transactions(
    connection: &String,
    networks: &Networks,
    redis: Arc<Redis>,
    retry_count: i32,
    failed_transactions_list: Vec<(CustomerExpenditureGetWithPayload, Apps, User)>,
    enigma: &EnigmaEncryptionService,
) {
    let db_config = db::pool_manager(connection);

    let pool: Pool<AsyncPgConnection> = Pool::builder(db_config)
        .max_size(failed_transactions_list.len())
        .build()
        .expect("Failed to create pool");

    let pool_ref = &pool;

    // Connect only to networks with work, so an idle network's outage can't block retries.
    let normal_sdk = if failed_transactions_list
        .iter()
        .any(|(tx, _, _)| !tx.infinity)
    {
        Some(generate_normal_avail_sdk(&networks.normal_endpoints).await)
    } else {
        None
    };
    let infinity_sdk = if failed_transactions_list
        .iter()
        .any(|(tx, _, _)| tx.infinity)
    {
        Some(generate_avail_sdk(&networks.infinity_endpoints).await)
    } else {
        None
    };
    let normal_sdk = normal_sdk.as_ref();
    let infinity_sdk = infinity_sdk.as_ref();

    let futures = failed_transactions_list.into_iter().enumerate().map(
        |(index, (customer_expenditure_details, account_details, _))| {
            let redis = Arc::clone(&redis);
            async move {
                let mut connection = pool_ref.get().await.unwrap();
                tracing::info!(
                    submission_id = ?customer_expenditure_details.id,
                    "processing failed transaction"
                );
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

                let infinity = customer_expenditure_details.infinity;
                let avail_app_id = account_details.app_id;
                let submit_data_class = match (infinity, normal_sdk, infinity_sdk) {
                    (false, Some(sdk), _) => {
                        SubmitDataAvail::normal(sdk, &networks.normal_keypairs[index], avail_app_id)
                    }
                    (true, _, Some(sdk)) => SubmitDataAvail::infinity(
                        sdk,
                        &networks.infinity_keypairs[index],
                        avail_app_id,
                    ),
                    _ => {
                        log_error(
                            &customer_expenditure_details.id.to_string(),
                            "No client for the transaction's network",
                        );
                        return;
                    }
                };

                let response = Response {
                    raw_payload: data.into(),
                    submission_id: customer_expenditure_details.id,
                    thread_id: 0,
                    app_id: account_details.id,
                    avail_app_id,
                    infinity,
                    otel_context: tracing_opentelemetry::OpenTelemetrySpanExt::context(
                        &tracing::Span::current(),
                    ),
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
                        tracing::info!(
                            submission_id = ?customer_expenditure_details.id,
                            "successfully processed response"
                        );
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
    tracing::error!(
        id = ?id,
        message = ?message,
        "fallback transaction error"
    );
    log_fallback_txn_error(id, message);
}

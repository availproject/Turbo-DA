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

use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncConnection, AsyncPgConnection,
};
use observability::{log_fallback_txn_error, log_retry_count};
use turbo_da_core::logger::{error, info};
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
    connection: &String,
    client: &SDK,
    account: &Vec<Keypair>,
    retry_count: i32,
    limit: i64,
) {
    let mut connection_client = AsyncPgConnection::establish(connection)
        .await
        .expect("Failed to connect to db");
    let unresolved_transactions =
        get_unresolved_transactions(&mut connection_client, retry_count, limit).await;

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
            error(&format!("Couldn't fetch unresolved transactions from db"));
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
    client: &SDK,
    account: &Vec<Keypair>,
    retry_count: i32,
    failed_transactions_list: Vec<(CustomerExpenditureGetWithPayload, Apps, User)>,
) {
    let db_config = AsyncDieselConnectionManager::<AsyncPgConnection>::new(connection);

    let pool: Pool<AsyncPgConnection> = Pool::builder(db_config)
        .max_size(failed_transactions_list.len())
        .build()
        .expect("Failed to create pool");

    let pool_ref = &pool;

    let futures = failed_transactions_list.into_iter().enumerate().map(
        |(index, (customer_expenditure_details, account_details, user_details))| async move {
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

            let convertor = Convertor::new(client, &account[index]);
            let credits_used = convertor.calculate_credit_utlisation(data.to_vec()).await;

            if credits_used >= account_details.credit_balance {
                if !account_details.fallback_enabled
                    || &credits_used - &account_details.credit_balance
                        >= user_details.credit_balance
                {
                    log_error(
                        &customer_expenditure_details.id.to_string(),
                        "Insufficient credits for user id",
                    );
                    return;
                }
            }

            let submit_data_class =
                SubmitDataAvail::new(client, &account[index], account_details.app_id);
            let submission = submit_data_class.submit_data(&data).await;

            match submission {
                Ok(success) => {
                    let fees_as_bigdecimal = BigDecimal::from(&success.gas_fee);

                    let tx_params = TxParams {
                        amount_data: format_size(data.len()),
                        amount_data_billed: credits_used,
                        fees: success.gas_fee,
                    };

                    let (billed_from_credit, billed_from_fallback) =
                        if account_details.credit_balance >= BigDecimal::from(0) {
                            if tx_params.amount_data_billed > account_details.credit_balance {
                                (
                                    account_details.credit_balance.clone(),
                                    &tx_params.amount_data_billed - &account_details.credit_balance,
                                )
                            } else {
                                (tx_params.amount_data_billed.clone(), BigDecimal::from(0))
                            }
                        } else {
                            (BigDecimal::from(0), tx_params.amount_data_billed.clone())
                        };

                    // Convert BigDecimal values to u64 and create wallet store
                    let fallback_u64 = billed_from_fallback
                        .round(0)
                        .to_string()
                        .parse::<i128>()
                        .unwrap_or(0);
                    let credit_u64 = billed_from_credit
                        .round(0)
                        .to_string()
                        .parse::<i128>()
                        .unwrap_or(0);

                    let mut wallet_store = vec![0u8; 32];
                    wallet_store[0..16].copy_from_slice(&fallback_u64.to_be_bytes());
                    wallet_store[16..32].copy_from_slice(&credit_u64.to_be_bytes());

                    let result = update_customer_expenditure(
                        success,
                        &fees_as_bigdecimal,
                        &tx_params.amount_data_billed,
                        &wallet_store,
                        customer_expenditure_details.id,
                        &mut connection,
                    )
                    .await;
                    if result.is_err() {
                        log_error(
                            &customer_expenditure_details.id.to_string(),
                            "Failed to update customer expenditure",
                        );
                    }
                    let result = update_credit_balance(
                        &mut connection,
                        &account_details,
                        &tx_params,
                        &billed_from_credit,
                        &billed_from_fallback,
                    )
                    .await;
                    if result.is_err() {
                        log_error(
                            &customer_expenditure_details.id.to_string(),
                            "Failed to update credit balance",
                        );
                        return;
                    }
                    info(&format!(
                        "Successfully processed failed transaction submission id: {:?} ",
                        customer_expenditure_details.id
                    ));
                }
                Err(e) => {
                    log_error(&customer_expenditure_details.id.to_string(), &e);
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

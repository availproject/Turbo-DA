use crate::{
    models::customer_expenditure::{
        CreateCustomerExpenditure, CustomerExpenditureGet, CustomerExpenditureGetWithPayload,
    },
    schema::customer_expenditures::dsl::*,
};
use bigdecimal::BigDecimal;

use diesel::{prelude::*, result::Error};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use enigma::types::EncryptResponse;
use log::{error, info};
use serde_json::{json, Value};
use uuid::Uuid;

use avail_utils::submit_data::TransactionInfo;

pub fn error_log(message: &String) {
    error!(
        "{}",
        serde_json::json!({
            "message": message,
            "level": "error"
        })
    );
}

pub fn info_log(message: &String) {
    info!(
        "{}",
        serde_json::json!({
            "message": message,
            "level": "info"
        })
    );
}

/// Retrieves information about a specific customer expenditure submission
///
/// # Arguments
/// * `connection` - Database connection handle
/// * `submission_id` - UUID of the submission to retrieve
///
/// # Returns
/// * `HttpResponse` - JSON response containing submission details or error message
///
/// # Description
/// Queries the database for a specific customer expenditure entry and returns:
/// - 200 OK with submission details if found
/// - 404 Not Found if submission ID doesn't exist
/// - 500 Internal Server Error for database errors
pub async fn handle_submission_info(
    connection: &mut AsyncPgConnection,
    submission_id: Uuid,
) -> Result<Value, Error> {
    match customer_expenditures
        .filter(id.eq(submission_id))
        .select(CustomerExpenditureGet::as_select())
        .first::<CustomerExpenditureGet>(connection)
        .await
    {
        Ok(sub) => {
            let response = json!({
                "submission": sub,
                "id": sub.id,
                "state": if sub.error.is_some() { "Error" } else if sub.block_hash.is_some() { "Finalized" } else { "Pending" },
                "error": sub.error,
                "data": if sub.error.is_some() {
                    None
                } else {
                    Some(json!({
                        "user_id": sub.user_id,
                        "amount_data": sub.amount_data,
                        "fees": sub.fees.map(|f| f.to_string()),
                        "block_number": sub.block_number,
                        "block_hash": sub.block_hash.map(|h| format!("0x{}", h)),
                        "tx_hash": sub.tx_hash.map(|h| format!("0x{}", h)),
                        "data_hash": sub.data_hash.map(|h| format!("0x{}", h)),
                        "tx_index": sub.extrinsic_index,
                        "data_billed": sub.converted_fees.map(|f| f.to_string()),
                        "created_at": sub.created_at,
                        "ciphertext_hash": sub.ciphertext_hash,
                        "plaintext_hash": sub.plaintext_hash,
                        "signature_ciphertext_hash": sub.signature_ciphertext_hash,
                        "signature_plaintext_hash": sub.signature_plaintext_hash,
                        "address": sub.address,
                        "ephemeral_pub_key": sub.ephemeral_pub_key
                    }))
                }
            });
            Ok(response)
        }
        Err(Error::NotFound) => Err(Error::NotFound),
        Err(_) => Err(Error::NotFound),
    }
}

pub async fn update_customer_expenditure(
    result: TransactionInfo,
    encrypted_response: Option<EncryptResponse>,
    fees_as_bigdecimal: &BigDecimal,
    fees_as_bigdecimal_in_avail: &BigDecimal,
    wallet_store: &Vec<u8>,
    submission_id: Uuid,
    connection: &mut AsyncPgConnection,
) -> Result<(), String> {
    let update_values = (
        fees.eq(fees_as_bigdecimal),
        converted_fees.eq(fees_as_bigdecimal_in_avail),
        to_address.eq(Some(result.to_address)),
        block_hash.eq(Some(result.block_hash)),
        data_hash.eq(Some(result.data_hash)),
        tx_hash.eq(Some(result.tx_hash)),
        extrinsic_index.eq(Some(result.extrinsic_index as i32)),
        block_number.eq(Some(result.block_number as i32)),
        wallet.eq(wallet_store),
        payload.eq(None::<Vec<u8>>),
        error.eq(None::<String>),
        ciphertext_hash.eq(encrypted_response
            .as_ref()
            .map(|r| r.ciphertext_hash.clone())),
        plaintext_hash.eq(encrypted_response
            .as_ref()
            .map(|r| r.plaintext_hash.clone())),
        signature_ciphertext_hash.eq(encrypted_response
            .as_ref()
            .map(|r| r.signature_ciphertext_hash.as_bytes())),
        signature_plaintext_hash.eq(encrypted_response
            .as_ref()
            .map(|r| r.signature_plaintext_hash.as_bytes())),
        address.eq(encrypted_response.as_ref().map(|r| r.address.to_vec())),
        ephemeral_pub_key.eq(encrypted_response
            .as_ref()
            .map(|r| r.ephemeral_pub_key.clone())),
    );

    diesel::update(customer_expenditures.filter(id.eq(submission_id)))
        .set(update_values.clone())
        .execute(connection)
        .await
        .map_err(|e| {
            format!(
                "Couldn't insert customer expenditure entry {:?} {:?} {:?}. Error: {:?}",
                update_values.0, update_values.1, update_values.2, e
            )
        })?;
    Ok(())
}

pub async fn create_customer_expenditure_entry(
    connection: &mut AsyncPgConnection,
    customer_expendire_entry: CreateCustomerExpenditure,
) {
    match diesel::insert_into(customer_expenditures)
        .values(&customer_expendire_entry)
        .execute(connection)
        .await
    {
        Ok(_) => {
            info_log(&format!(
                "Customer Expenditure entry created {}",
                &customer_expendire_entry.id
            ));
        }
        Err(e) => {
            error_log(
                &format!(
                    "Couldn't create a new customer expenditure entry with submission id {}. Error {:?}",
                    customer_expendire_entry.id, e
                )
            );
        }
    };
}

pub async fn get_customer_expenditure_by_submission_id(
    connection: &mut AsyncPgConnection,
    submission_id: Uuid,
) -> Result<CustomerExpenditureGetWithPayload, Error> {
    customer_expenditures
        .filter(id.eq(submission_id))
        .select(CustomerExpenditureGetWithPayload::as_select())
        .first::<CustomerExpenditureGetWithPayload>(connection)
        .await
}

/// Retrieves all expenditure entries for a specific user
///
/// # Arguments
/// * `connection` - Database connection handle
/// * `user` - User ID string
/// * `final_limit` - Maximum number of entries to return
///
/// # Returns
/// * `HttpResponse` - JSON response containing list of expenditures or error message
///
/// # Description
/// Queries the database for all expenditure entries belonging to the specified user,
/// limited by the provided count. Returns:
/// - 200 OK with list of expenditures if successful
/// - 500 Internal Server Error if database query fails
pub async fn handle_get_all_expenditure(
    connection: &mut AsyncPgConnection,
    user: String,
    final_limit: i64,
) -> Result<Value, Error> {
    match customer_expenditures
        .filter(user_id.eq(user))
        .limit(final_limit)
        .select(CustomerExpenditureGet::as_select())
        .load(connection)
        .await
    {
        Ok(results) => Ok(json!({"results":results})),
        Err(_) => Err(Error::NotFound),
    }
}

pub async fn handle_get_expenditure_by_time_range(
    connection: &mut AsyncPgConnection,
    user: &String,
    start_date: chrono::NaiveDateTime,
    end_date: chrono::NaiveDateTime,
    app: &Uuid,
) -> Result<Vec<CustomerExpenditureGet>, Error> {
    customer_expenditures
        .filter(user_id.eq(user))
        .filter(app_id.eq(app))
        .filter(created_at.ge(start_date))
        .filter(created_at.le(end_date))
        .select(CustomerExpenditureGet::as_select())
        .load::<CustomerExpenditureGet>(&mut *connection)
        .await
}

/// Adds or updates an error entry for a specific submission
///
/// # Arguments
/// * `sub_id` - UUID of the submission to update
/// * `e` - Error message string to store
/// * `connection` - Database connection handle
///
/// # Description
/// Updates the error field of a customer expenditure entry with the provided error message.
/// Logs success or failure of the update operation.
pub async fn add_error_entry(sub_id: &Uuid, e: String, connection: &mut AsyncPgConnection) {
    let update_values = (error.eq(e.to_string()),);

    let tx = diesel::update(customer_expenditures.filter(id.eq(sub_id)))
        .set(update_values)
        .execute(connection)
        .await;

    match tx {
        Ok(_) => {
            info_log(&format!(
                "Error logged updated for submission id {:?}",
                sub_id
            ));
        }
        Err(e) => {
            error_log(&format!("Couldn't insert error log value. Error: {:?}", e));
        }
    }
}

/// Increments the retry count for a specific transaction entry
///
/// # Arguments
/// * `entry_id` - UUID of the transaction entry to update
/// * `connection` - Database connection handle
///
/// # Returns
/// * `Ok(())` - Successfully incremented retry count
/// * `Err(String)` - Error message if update fails
///
/// # Description
/// Updates the retry_count field by incrementing it by 1 for the specified transaction.
/// Returns an error if:
/// 1. No rows were updated (entry not found)
/// 2. Database update operation fails
pub async fn increase_retry_count(
    entry_id: Uuid,
    connection: &mut AsyncPgConnection,
) -> Result<(), String> {
    match diesel::update(customer_expenditures.filter(id.eq(entry_id)))
        .set(retry_count.eq(retry_count + 1))
        .execute(connection)
        .await
    {
        Ok(size) => {
            if size == 0 {
                error_log(&format!(
                    "Failed to increase retry count for entry id: {:?}",
                    entry_id
                ));
                return Err("Failed to increase retry count for entry id".to_string());
            }
            Ok(())
        }
        Err(e) => {
            error_log(&format!(
                "Failed to increase retry count for entry id: {:?}",
                e
            ));
            return Err("Failed to increase retry count for entry id".to_string());
        }
    }
}

pub async fn get_did_fallback_resolved(
    connection: &mut AsyncPgConnection,
    submission_id: &Uuid,
) -> bool {
    match customer_expenditures
        .filter(id.eq(submission_id))
        .select(CustomerExpenditureGet::as_select())
        .first::<CustomerExpenditureGet>(connection)
        .await
    {
        Ok(sub) => sub.tx_hash.is_some(),
        Err(_) => false,
    }
}

pub async fn handle_reset_retry_count(
    connection: &mut AsyncPgConnection,
    app: &Option<Uuid>,
    retry: &i32,
    expenditure_id: &Option<Uuid>,
) -> Result<(), String> {
    let result;
    if let Some(expenditure_id) = expenditure_id {
        result = diesel::update(customer_expenditures.filter(id.eq(expenditure_id)))
            .set(retry_count.eq(retry))
            .execute(connection)
            .await
            .map_err(|e| e.to_string());
    } else {
        result = match app {
            Some(app) => {
                diesel::update(customer_expenditures.filter(app_id.eq(app)))
                    .set(retry_count.eq(retry))
                    .execute(connection)
                    .await
            }
            None => {
                diesel::update(customer_expenditures)
                    .set(retry_count.eq(retry))
                    .execute(connection)
                    .await
            }
        }
        .map_err(|e| e.to_string());
    }
    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(e),
    }
}

pub async fn handle_get_wallet_usage(
    connection: &mut AsyncPgConnection,
    user: &String,

    start_date: chrono::NaiveDateTime,
    end_date: chrono::NaiveDateTime,
) -> Result<Vec<CustomerExpenditureGet>, Error> {
    customer_expenditures
        .filter(user_id.eq(user))
        .filter(created_at.ge(start_date))
        .filter(created_at.le(end_date))
        .select(CustomerExpenditureGet::as_select())
        .load::<CustomerExpenditureGet>(&mut *connection)
        .await
}

// todo : for migration only, remove this function after migration
pub async fn update_wallet_store(connection: &mut AsyncPgConnection) -> Result<(), String> {
    let list = customer_expenditures
        .filter(wallet.is_null())
        .select(CustomerExpenditureGet::as_select())
        .load::<CustomerExpenditureGet>(connection)
        .await
        .unwrap();

    println!("list: {:?}", list.len());

    for (index, item) in list.iter().enumerate() {
        if item.converted_fees.is_some() {
            let mut wallet_store = vec![0u8; 32];

            wallet_store[16..32].copy_from_slice(
                &item
                    .converted_fees
                    .as_ref()
                    .unwrap()
                    .to_string()
                    .parse::<i128>()
                    .unwrap()
                    .to_be_bytes(),
            );

            let _ = diesel::update(customer_expenditures.filter(id.eq(item.id)))
                .set(wallet.eq(wallet_store))
                .execute(connection)
                .await
                .map_err(|e| e.to_string());

            println!("submission id: {:?} index {:?}", item.id, index);
        }
    }
    Ok(())
}

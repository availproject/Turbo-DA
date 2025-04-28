use crate::{
    models::customer_expenditure::{
        CreateCustomerExpenditure, CustomerExpenditureGet, CustomerExpenditureGetWithPayload,
    },
    schema::customer_expenditures::dsl::*,
};
use bigdecimal::BigDecimal;
use diesel::{prelude::*, result::Error};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::{error, info};
use serde_json::{json, Value};
use uuid::Uuid;

use avail_utils::submit_data::TransactionInfo;

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
                        "created_at": sub.created_at
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
    fees_as_bigdecimal: &BigDecimal,
    fees_as_bigdecimal_in_avail: &BigDecimal,
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
        payload.eq(None::<Vec<u8>>),
        error.eq(None::<String>),
    );

    diesel::update(customer_expenditures.filter(id.eq(submission_id)))
        .set(update_values.clone())
        .execute(connection)
        .await
        .map_err(|e| {
            format!(
                "Couldn't insert customer expenditure entry {:?}. Error: {:?}",
                update_values, e
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
            info!(
                "Customer Expenditure entry created {}",
                &customer_expendire_entry.id
            );
        }
        Err(e) => {
            error!(
                "Couldn't create a new customer expenditure entry with submission id {}. Error {:?}",
                customer_expendire_entry.id, e
            );
        }
    };
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
            info!("Error logged updated for submission id {:?} ", sub_id);
        }
        Err(e) => {
            error!("Couldn't insert error log value. Error: {:?}", e);
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
                error!(
                    "Failed to increase retry count for entry id: {:?}",
                    entry_id
                );
                return Err("Failed to increase retry count for entry id".to_string());
            }
            Ok(())
        }
        Err(e) => {
            error!("Failed to increase retry count for entry id: {:?}", e);
            return Err("Failed to increase retry count for entry id".to_string());
        }
    }
}

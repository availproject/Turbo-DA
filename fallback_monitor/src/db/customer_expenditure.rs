use db::{
    models::customer_expenditure::CustomerExpenditureGetWithPayload,
    schema::customer_expenditures::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::error;
use uuid::Uuid;

/// Retrieves unresolved transactions from the database that have not exceeded retry limit
///
/// # Arguments
/// * `connection` - Database connection handle
/// * `retry` - Maximum number of retry attempts allowed
///
/// # Returns
/// * `Ok(Vec<CustomerExpenditureGetWithPayload>)` - List of unresolved transactions
/// * `Err(String)` - Error message if database query fails
///
/// # Description
/// Queries the database for transactions that:
/// 1. Have an error or payload
/// 2. Have not exceeded the maximum retry count
/// 3. Are ordered by creation date descending
pub async fn get_unresolved_transactions(
    connection: &mut AsyncPgConnection,
    retry: i32,
) -> Result<Vec<CustomerExpenditureGetWithPayload>, String> {
    match customer_expenditures
        .filter(error.is_not_null())
        .or_filter(payload.is_not_null())
        .filter(retry_count.lt(retry))
        .order(created_at.desc())
        .select(CustomerExpenditureGetWithPayload::as_select())
        .load(connection)
        .await
    {
        Ok(list) => Ok(list),
        Err(_) => Err("DB Call Error".to_string()),
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

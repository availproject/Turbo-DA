use actix_web::HttpResponse;
use customer_expenditure::CustomerExpenditureGet;
use db::{models::*, schema::customer_expenditures::dsl::*};
use diesel::{prelude::*, result::Error};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::{error, info};
use serde_json::json;
use uuid::Uuid;

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
) -> HttpResponse {
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
            HttpResponse::Ok().json(response)
        }
        Err(Error::NotFound) => HttpResponse::NotFound()
            .json(json!({ "error": "Customer Expenditure entry not found" })),
        Err(_) => HttpResponse::InternalServerError().json(json!({ "error": "Database error" })),
    }
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
) -> HttpResponse {
    match customer_expenditures
        .filter(user_id.eq(user))
        .limit(final_limit)
        .select(CustomerExpenditureGet::as_select())
        .load(connection)
        .await
    {
        Ok(results) => HttpResponse::Ok().json(json!({"results":results})),
        Err(_) => HttpResponse::InternalServerError()
            .body("Database error: Couldn't fetch customer_expenditure entry"),
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

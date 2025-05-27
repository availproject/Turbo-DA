use crate::utils::get_connection;
use actix_web::{
    get,
    web::{self},
    HttpResponse, Responder,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde_json::json;

/// Get the current status of the indexer
///
/// # Description
/// Retrieves the current status and metrics of the indexer system
///
/// # Route
/// `GET /v1/admin/indexer_status`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication (requires admin role)
///
/// # Returns
/// JSON response containing indexer status information
///
/// # Example Request
/// ```bash
/// curl -X GET "https://api.example.com/v1/admin/indexer_status" \
///      -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
/// ```
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Indexer values fetched successfully",
///   "data": {
///     "last_block": 12345678,
///     "is_syncing": false,
///     "current_block": 12345678
///   }
/// }
/// ```
#[get("/indexer_status")]
pub async fn indexer_status(
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let data = db::controllers::misc::indexer_status(&mut connection).await;
    match data {
        Ok(data) => HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Indexer values fetched successfully", "data": data})),
        Err(e) => HttpResponse::InternalServerError().json(json!({"state": "ERROR", "message": e})),
    }
}

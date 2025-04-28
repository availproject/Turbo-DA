use crate::{
    config::AppConfig,
    utils::{get_connection, retrieve_user_id_from_jwt},
};
use actix_web::{get, web, HttpRequest, HttpResponse, Responder};
use db::controllers::customer_expenditure::handle_get_all_expenditure;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use validator::Validate;

/// Query parameters for retrieving customer expenditures with optional limit
#[derive(Deserialize, Serialize)]
struct GetAllExpenditures {
    limit: Option<i64>,
}

/// Request payload for retrieving detailed token expenditure information
#[derive(Deserialize, Serialize, Validate)]
struct GetTokenExpenditure {
    token_id: i32,
}

/// Retrieves all expenditure records for an authenticated customer
///
/// This endpoint allows customers to view their transaction history and
/// track how they've spent their credits on Avail data submissions.
/// The results include transaction details such as data size, fees paid,
/// and submission status.
///
/// # Arguments
/// * `request_payload` - Query parameters containing optional result limit
/// * `config` - Application configuration with default limits
/// * `injected_dependency` - Database connection pool for data access
/// * `http_request` - HTTP request containing JWT for user authentication
///
/// # Returns
/// * Success: JSON response with a list of expenditure records
/// * Error: 500 status code with error message if user authentication or database access fails
#[get("/get_all_expenditure")]
pub async fn get_all_expenditure(
    request_payload: web::Query<GetAllExpenditures>,
    config: web::Data<AppConfig>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let limit = request_payload.limit;
    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let final_limit = match limit {
        Some(l) => l,
        None => config.total_users_query_limit,
    };

    match handle_get_all_expenditure(&mut connection, user, final_limit).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::InternalServerError().json(json!({ "error": e.to_string() })),
    }
}

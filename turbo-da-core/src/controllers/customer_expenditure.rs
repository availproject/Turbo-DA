use crate::{
    config::AppConfig,
    db::customer_expenditure::handle_get_all_expenditure,
    utils::{get_connection, retrieve_user_id_from_jwt},
};
use actix_web::{get, web, HttpRequest, HttpResponse, Responder};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use validator::Validate;

/// Query parameters for retrieving expenditures with optional limit
#[derive(Deserialize, Serialize)]
struct GetAllExpenditures {
    limit: Option<i64>,
}

/// Request payload for retrieving token expenditure details
#[derive(Deserialize, Serialize, Validate)]
struct GetTokenExpenditure {
    token_id: i32,
}

/// Retrieves all expenditures for an authenticated user
///
/// # Arguments
/// * `request_payload` - Query parameters containing optional limit
/// * `config` - Application configuration
/// * `injected_dependency` - Database connection pool
/// * `http_request` - HTTP request containing user authentication
///
/// # Returns
/// JSON response containing list of expenditures or error
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

    handle_get_all_expenditure(&mut connection, user, final_limit).await
}

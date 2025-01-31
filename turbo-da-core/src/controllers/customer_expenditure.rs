use crate::{
    config::AppConfig,
    db::customer_expenditure::{handle_get_all_expenditure, handle_submission_info},
    utils::{get_connection, retrieve_user_id_from_jwt},
};
use actix_web::{get, web, HttpRequest, HttpResponse, Responder};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use uuid::Uuid;
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

/// Query parameters for retrieving submission information
#[derive(Deserialize, Serialize)]
struct GetSubmissionInfo {
    submission_id: String,
}

/// Retrieves information about a specific submission
///
/// # Arguments
/// * `request_payload` - Query parameters containing submission ID
/// * `injected_dependency` - Database connection pool
///
/// # Returns
/// * `HttpResponse` - JSON response containing submission details or error
///
/// # Description
/// Validates the submission ID as a UUID and retrieves associated information
/// from the database. Returns error responses for invalid UUIDs or failed queries.
#[get("/get_submission_info")]
pub async fn get_submission_info(
    request_payload: web::Query<GetSubmissionInfo>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> HttpResponse {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };
    let submission_id = match Uuid::from_str(&request_payload.submission_id) {
        Ok(val) => val,
        Err(e) => {
            return HttpResponse::NotAcceptable().body(e.to_string());
        }
    };
    handle_submission_info(&mut connection, submission_id).await
}

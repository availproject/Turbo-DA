use crate::{
    config::AppConfig,
    utils::{get_connection, retrieve_user_id_from_jwt},
};
use actix_web::{get, put, web, HttpRequest, HttpResponse, Responder};
use chrono::{DateTime, Datelike, NaiveDateTime};
use db::controllers::customer_expenditure::{
    handle_get_all_expenditure, handle_get_expenditure_by_time_range, handle_get_wallet_usage,
    handle_reset_retry_count,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;
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
/// # Description
/// This endpoint allows customers to view their transaction history and
/// track how they've spent their credits on Avail data submissions.
/// The results include transaction details such as data size, fees paid,
/// and submission status.
///
/// # Route
/// `GET /v1/user/get_all_expenditure?limit={limit}`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request
///
/// # Query Parameters
/// * `limit` - Optional parameter to limit the number of records returned
///
/// # Returns
/// * Success: JSON response with a list of expenditure records
/// * Error: 500 status code with error message if user authentication or database access fails
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Expenditure retrieved successfully",
///   "data": {
///     "results": [
///       {
///         "id": "123e4567-e89b-12d3-a456-426614174000",
///         "user_id": "user123",
///         "extrinsic_index": 42,
///         "amount_data": "1024",
///         "fees": "0.05",
///         "to_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
///         "block_number": 12345,
///         "block_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
///         "data_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
///         "tx_hash": "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
///         "created_at": "2023-01-01T12:00:00Z",
///         "error": null,
///         "converted_fees": "0.05",
///         "app_id": "123e4567-e89b-12d3-a456-426614174001"
///       }
///     ]
///   }
/// }
/// ```
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
        None => {
            return HttpResponse::InternalServerError()
                .json(json!({ "state": "ERROR", "error": "User Id not retrieved" }))
        }
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
        Ok(response) => HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Expenditure retrieved successfully", "data": response})),
        Err(e) => HttpResponse::InternalServerError().json(json!({ "state": "ERROR", "error": e.to_string() })),
    }
}

#[derive(Deserialize, Serialize)]
struct ExpenditureTimeRangeQuery {
    start_date: NaiveDateTime,
    end_date: NaiveDateTime,
    app_id: Uuid,
}

#[get("/get_expenditure_by_time_range")]
pub async fn get_expenditure_by_time_range(
    request_payload: web::Query<ExpenditureTimeRangeQuery>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError()
                .json(json!({ "state": "ERROR", "error": "User Id not retrieved" }))
        }
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    match handle_get_expenditure_by_time_range(&mut connection, &user, request_payload.start_date, request_payload.end_date, &request_payload.app_id).await {
        Ok(response) => HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Expenditure retrieved successfully", "data": response})),
        Err(e) => HttpResponse::InternalServerError().json(json!({ "state": "ERROR", "error": e.to_string() })),
    }
}

#[derive(Deserialize, Serialize)]
struct ResetRetryCountParams {
    retry_count: i32,
    app_id: Option<Uuid>,
    expenditure_id: Option<Uuid>,
}

/// Resets the retry count for all customer expenditures
///
/// # Description
/// This endpoint allows administrators to reset the retry count for all customer expenditures.
/// This is useful when there is a need to reprocess all transactions that have failed due to temporary issues.
///
/// # Route
/// `PUT /v1/user/reset_retry_count`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
/// * `Content-Type: application/json`
///
/// # Request Body
/// ```json
/// {
///   "retry_count": 0,
///   "app_id": "optional-uuid",
///   "expenditure_id": "optional-uuid"
/// }
/// ```
///
/// # Example Request
/// ```bash
/// curl -X PUT "https://api.example.com/v1/user/reset_retry_count" \
///      -H "Authorization: Bearer YOUR_TOKEN" \
///      -H "Content-Type: application/json" \
///      -d '{
///        "retry_count": 0,
///        "app_id": "123e4567-e89b-12d3-a456-426614174000"
///      }'
/// ```
///
/// # Returns
/// * Success: 200 OK with success message
/// * Error: 500 Internal Server Error with error message
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Retry count reset successfully"
/// }
/// ```
#[put("/reset_retry_count")]
pub async fn reset_retry_count(
    payload: web::Json<ResetRetryCountParams>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    match handle_reset_retry_count(
        &mut connection,
        &payload.app_id,
        &payload.retry_count,
        &payload.expenditure_id,
    )
    .await
    {
        Ok(_) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "Retry count reset successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string()
        })),
    }
}

#[derive(Deserialize, Serialize)]
struct GetWalletUsageParams {
    app_id: Uuid,
    pub start_date: i64, // UTC timestamp in seconds
    pub end_date: i64,   // UTC timestamp in seconds
}

#[get("/get_wallet_usage")]
pub async fn get_wallet_usage(
    params: web::Query<GetWalletUsageParams>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError()
                .json(json!({ "state": "ERROR", "error": "User Id not retrieved" }))
        }
    };

    let start_date = match DateTime::from_timestamp(params.start_date, 0) {
        Some(date) => date.naive_utc(),
        None => {
            return HttpResponse::InternalServerError()
                .json(json!({ "state": "ERROR", "error": "Invalid start date" }))
        }
    };

    let end_date = match DateTime::from_timestamp(params.end_date, 0) {
        Some(date) => date.naive_utc(),
        None => {
            return HttpResponse::InternalServerError()
                .json(json!({ "state": "ERROR", "error": "Invalid end date" }))
        }
    };
    match handle_get_wallet_usage(&mut connection, &user, &params.app_id, start_date, end_date)
        .await
    {
        Ok(response) => {
            let wallet_usage: Vec<(i128, i128)> =
                response
                    .iter()
                    .fold(vec![(0i128, 0i128); 12], |mut acc, item| {
                        if let Some(wallet) = &item.wallet {
                            let month = item.created_at.month() as usize - 1; // 0-based index
                            let fallback = acc[month].0
                                + i128::from_be_bytes(
                                    wallet[0..16].try_into().unwrap_or_else(|_| [0; 16]),
                                );
                            let credit = acc[month].1
                                + i128::from_be_bytes(
                                    wallet[16..32].try_into().unwrap_or_else(|_| [0; 16]),
                                );
                            acc[month] = (fallback, credit);
                        }
                        acc
                    });

            let data = json!({
                "wallet_usage": wallet_usage,
                "list": response
            });

            HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Wallet usage retrieved successfully", "data": data}))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(json!({ "state": "ERROR", "error": e.to_string() })),
    }
}

use crate::{
    config::AppConfig,
    db::customer_expenditure::{
        handle_get_all_expenditure, handle_get_customer_expenditure_using_token_id,
        handle_submission_info,
    },
    utils::{get_connection, retrieve_user_id},
};
use actix_web::{get, web, HttpRequest, HttpResponse, Responder};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Serialize)]
struct GetAllExpenditures {
    limit: Option<i64>,
}

#[derive(Deserialize, Serialize, Validate)]
struct GetTokenExpenditure {
    token_id: i32,
}

/// Retrieve details about all expenditures made by a user.
///
/// # Description
/// This endpoint allows a user to retrieve a list of all their expenditure records. It provides details such as the amount spent, transaction fees, and associated blockchain information. The response can be limited by the `limit` parameter if provided.
///
/// # Route
/// `GET /user/get_all_expenditure`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request. The token should belong to the user whose expenditure records are being queried.
///
/// # URL Parameters
/// * `limit` (optional) - The maximum number of entries to return in the response. If not provided, the server may return a default number of records.
///
/// # Returns
/// A JSON array of expenditure records, each including details such as ID, user ID, token details, transaction data, fees, addresses, and timestamps.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/user/get_all_expenditure" \
///      -H "Authorization: Bearer YOUR_TOKEN"
/// ```
///
/// # Example Response
///
/// ```json
/// [
///   {
///     "id": "b9a3f58e-0f49-4e3b-9466-f28d73d75e0a",
///     "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
///     "token_details_id": 1,
///     "extrinsic_index": 42,
///     "amount_data": "100.00",
///     "fees": "0.01",
///     "to_address": "0x123abc456def789ghi",
///     "block_hash": "0xabcdef1234567890",
///     "data_hash": "0xdeadbeef12345678",
///     "tx_hash": "0xabcdef9876543210",
///     "created_at": "2024-09-11T12:34:56"
///   }
/// ]
/// ```

#[get("/get_all_expenditure")]
pub async fn get_all_expenditure(
    request_payload: web::Query<GetAllExpenditures>,
    config: web::Data<AppConfig>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let limit = request_payload.limit;
    let user = match retrieve_user_id(http_request) {
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

/// Retrieve details about expenditures made using a specific token.
///
/// # Description
/// This endpoint retrieves a list of expenditure records that were made using a given token. It provides information about the transaction, including amounts, fees, and blockchain-related details. The `token_id` parameter is used to filter the expenditures associated with a specific token.
///
/// # Route
/// `GET /user/get_token_expenditure`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request. The token should belong to the user whose expenditure records are being queried.
///
/// # URL Parameters
/// * `token_id` - The ID of the token for which expenditures are being queried. This ID corresponds to the token details in the database.
///
/// # Returns
/// A JSON array of expenditure records related to the specified token, including details such as ID, user ID, transaction data, amounts, fees, addresses, and timestamps.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/user/get_token_expenditure?token_id=1" \
///      -H "Authorization: Bearer YOUR_TOKEN"
/// ```
///
/// # Example Response
///
/// ```json
/// [
///   {
///     "id": "b9a3f58e-0f49-4e3b-9466-f28d73d75e0a",
///     "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
///     "token_details_id": 1,
///     "extrinsic_index": 42,
///     "amount_data": "100.00",
///     "fees": "0.01",
///     "to_address": "0x123abc456def789ghi",
///     "block_hash": "0xabcdef1234567890",
///     "data_hash": "0xdeadbeef12345678",
///     "tx_hash": "0xabcdef9876543210",
///     "created_at": "2024-09-11T12:34:56"
///   }
/// ]
/// ```

#[get("/get_token_expenditure")]
pub async fn get_token_expenditure(
    request_payload: web::Query<GetTokenExpenditure>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let user = match retrieve_user_id(http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };
    let token = &request_payload.token_id;
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };
    handle_get_customer_expenditure_using_token_id(&mut connection, user, *token).await
}

#[derive(Deserialize, Serialize)]
struct GetSubmissionInfo {
    submission_id: String,
}

/// Retrieve details about a specific expenditure using a given submission ID.
///
/// # Description
/// This endpoint retrieves detailed information about a specific expenditure record based on the provided `submission_id`. It includes details such as amounts, fees, blockchain-related data, and timestamps.
///
/// # Route
/// `GET /user/get_submission_info`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request. The token should belong to the user making the request.
///
/// # URL Parameters
/// * `submission_id` - The unique ID of the expenditure record to retrieve. This ID corresponds to the submission record in the database.
///
/// # Returns
/// A JSON object containing detailed information about the specified expenditure record.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/user/get_submission_info?submission_id=b9a3f58e-0f49-4e3b-9466-f28d73d75e0a" \
///      -H "Authorization: Bearer YOUR_TOKEN"
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "id": "b9a3f58e-0f49-4e3b-9466-f28d73d75e0a",
///   "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
///   "token_details_id": 1,
///   "extrinsic_index": 42,
///   "amount_data": "100.00",
///   "fees": "0.01",
///   "to_address": "0x123abc456def789ghi",
///   "block_hash": "0xabcdef1234567890",
///   "data_hash": "0xdeadbeef12345678",
///   "tx_hash": "0xabcdef9876543210",
///   "created_at": "2024-09-11T12:34:56"
/// }
/// ```

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

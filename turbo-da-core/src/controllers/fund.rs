use crate::{
    config::AppConfig,
    utils::{generate_avail_sdk, get_connection, retrieve_user_id_from_jwt, Convertor, TOKEN_MAP},
};
use std::sync::Arc;

use actix_web::{
    get, post,
    web::{self, Bytes},
    HttpRequest, HttpResponse, Responder,
};

use avail_rust::prelude::*;
use bigdecimal::BigDecimal;
use db::controllers::fund::{create_credit_request, get_fund_status};

use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};

use serde::{Deserialize, Serialize};
use serde_json::json;

/// Parameters for registering a credit request
///
/// # Fields
/// * `chain` - The chain ID for which the credit request is being registered
#[derive(Deserialize, Serialize, Clone)]
struct RegisterCreditRequestParams {
    pub chain: i32,
}

/// Register a new credit request for a user
///
/// # Description
/// This endpoint allows a user to register a new credit request for a specific blockchain.
/// The request is stored in the database with a "pending" status for later processing.
///
/// # Route
/// `POST /v1/user/register_credit_request`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request
///
/// # Request Body
/// * `chain` - The chain ID for which the credit request is being registered
///
/// # Returns
/// * Success: JSON response with status "success" and the transaction data
/// * Error: Internal server error with appropriate error message
#[post("/register_credit_request")]
async fn register_credit_request(
    payload: web::Json<RegisterCreditRequestParams>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    // Extract user ID from JWT token
    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User Id not retrieved",
            }))
        }
    };

    // Establish database connection
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    // Create credit request in the database
    let tx = create_credit_request(user, payload.0.chain, &mut connection).await;
    match tx {
        Ok(tx) => HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Credit request created successfully", "data": tx})),
        Err(e) => HttpResponse::InternalServerError().json(json!({ "state": "ERROR", "message": e})),
    }
}

/// Retrieve a list of all fund transactions for a user
///
/// # Description
/// This endpoint retrieves all fund transactions associated with the authenticated user.
/// The transactions are fetched from the database and returned in a structured format.
///
/// # Route
/// `GET /v1/user/get_fund_list`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Returns
/// * 200 OK with a list of fund transactions if successful
/// * 500 Internal Server Error if user authentication fails or database errors occur
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Fund list retrieved successfully",
///   "data": [
///     {
///       "id": "uuid-string",
///       "user_id": "user@example.com",
///       "chain_id": 1,
///       "amount_credit": "100000000000000000000",
///       "request_status": "completed",
///       "request_type": "credit",
///       "tx_hash": "0x123abc456def789ghi",
///       "created_at": "2023-01-01T12:00:00Z"
///     }
///   ]
/// }
/// ```
#[get("/get_fund_list")]
pub async fn get_fund_list(
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User Id not retrieved",
            }))
        }
    };
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let tx = db::controllers::fund::get_fund_list(user, &mut connection).await;
    match tx {
        Ok(tx) => HttpResponse::Ok().json(
            json!({"state": "SUCCESS", "message": "Fund list retrieved successfully", "data": tx}),
        ),
        Err(e) => {
            HttpResponse::InternalServerError().json(json!({ "state": "ERROR", "message": e}))
        }
    }
}

/// Retrieve the status and details of a user's fund request.
///
/// # Description
/// This endpoint allows a user to retrieve the status and details of their fund request. The response includes information about the amount deposited, the amount of Avail approved, and the current status of the request.
///
/// # Route
/// `GET /v1/user/request_fund_status`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request. The token should belong to the user whose fund request status is being queried.
///
/// # Returns
/// A JSON object with details about the fund request, including the request ID, user ID, token address, amounts deposited and approved, request status, and creation timestamp.
///
/// # Example Response
///
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Fund request status retrieved successfully",
///   "data": [{
///     "amount_credit": "100000000000000000000", // scaled to 18 decimal places
///     "chain_id": 1,
///     "request_status": "pending",
///     "request_type": "credit",
///     "tx_hash": "0x123abc456def789ghi"
///   }]
/// }
/// ```

#[get("/request_fund_status")]
pub async fn request_funds_status(
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User Id not retrieved",
            }))
        }
    };
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let tx = get_fund_status(user, &mut connection).await;
    match tx {
        Ok(tx) => HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Fund request status retrieved successfully", "data": tx})),
        Err(e) => HttpResponse::InternalServerError().json(json!({ "state": "ERROR", "message": e})),
    }
}

#[derive(Deserialize, Serialize, Clone)]
struct PurchaseCostParams {
    pub data_size: u64, // in Bytes
}

/// Calculate the credit cost for a given data size.
///
/// # Description
/// This endpoint calculates the credit cost required to submit data of a specified size to the Avail network.
///
/// # Route
/// `GET /v1/user/purchase_cost?data_size={size}`
///
/// # Query Parameters
/// * `data_size` - The size of the data in bytes for which to calculate the credit cost.
///
/// # Returns
/// A JSON object containing the calculated credit cost for the specified data size.
///
/// # Example Response
///
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Credit cost calculated successfully",
///   "data": "0.0123456789"
/// }
/// ```

#[get("/purchase_cost")]
pub async fn purchase_cost(
    query: web::Query<PurchaseCostParams>,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let sdk = generate_avail_sdk(&Arc::new(config.avail_rpc_endpoint.clone())).await;
    let account = account::alice();

    let convertor = Convertor::new(&sdk, &account);

    let credits_cost = convertor
        .get_gas_price_for_data(convertor.one_kb.clone())
        .await;

    let credits_cost = credits_cost * BigDecimal::from(query.0.data_size as u128) / 1024.0;

    HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Credit cost calculated successfully", "data": credits_cost}))
}

#[derive(Deserialize, Serialize, Clone)]
pub struct EstimateCreditsParams {
    pub data: BigDecimal,
}

/// Estimate the credits required for a given data amount.
///
/// # Description
/// This endpoint estimates the number of credits required to process a specified amount of data.
///
/// # Route
/// `GET /v1/user/estimate_credits?data={amount}`
///
/// # Query Parameters
/// * `data` - The amount of data as a decimal value for which to estimate credit requirements.
///
/// # Returns
/// A JSON object containing the estimated credit cost for the specified data amount.
///
/// # Example Response
///
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Credit cost calculated successfully",
///   "data": "0.0123456789"
/// }
/// ```

#[get("/estimate_credits")]
pub async fn estimate_credits(
    query: web::Query<EstimateCreditsParams>,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let sdk = generate_avail_sdk(&Arc::new(config.avail_rpc_endpoint.clone())).await;
    let account = account::alice();

    let convertor = Convertor::new(&sdk, &account);

    let credits_cost = convertor
        .calculate_credit_utlisation(query.0.data.to_string().as_bytes().to_vec())
        .await;

    HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Credit cost calculated successfully", "data": credits_cost}))
}

/// Estimate the credits required for raw byte data.
///
/// # Description
/// This endpoint calculates the credit cost for submitting raw byte data to the Avail network.
///
/// # Route
/// `GET /v1/user/estimate_credits_for_bytes`
///
/// # Request Body
/// Raw bytes that represent the data for which to estimate credit requirements.
///
/// # Returns
/// A JSON object containing the estimated credit cost for the provided byte data.
///
/// # Example Response
///
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Credit cost calculated successfully",
///   "data": "0.0123456789"
/// }
/// ```

#[get("/estimate_credits_for_bytes")]
pub async fn estimate_credits_for_bytes(
    request_payload: Bytes,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let sdk = generate_avail_sdk(&Arc::new(config.avail_rpc_endpoint.clone())).await;
    let account = account::alice();

    let convertor = Convertor::new(&sdk, &account);

    let credits_cost = convertor
        .calculate_credit_utlisation(request_payload.to_vec())
        .await;

    HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Credit cost calculated successfully", "data": credits_cost}))
}

/// Retrieve the list of supported tokens and their corresponding addresses.
///
/// # Description
/// This endpoint provides a list of supported tokens along with their addresses. It helps clients understand which tokens are available for interactions and their associated addresses on the blockchain.
///
/// # Route
/// `GET /v1/user/token_map`
///
/// # Returns
/// A JSON object containing a mapping of token names to their addresses.
///
/// # Example Response
///
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Token map retrieved successfully",
///   "data": {
///     "ethereum": {
///       "token_address": "0xc...",
///       "other_properties": "..."
///     },
///     "cardano": {
///       "token_address": "0xd...",
///       "other_properties": "..."
///     }
///   }
/// }
/// ```

#[get("/token_map")]
pub async fn get_token_map() -> impl Responder {
    HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Token map retrieved successfully", "data": &*TOKEN_MAP}))
}

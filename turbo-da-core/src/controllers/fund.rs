use crate::{
    config::AppConfig,
    utils::{generate_avail_sdk, get_connection, retrieve_user_id_from_jwt, Convertor, TOKEN_MAP},
};
use std::sync::Arc;

use actix_web::{
    get,
    web::{self, Bytes},
    HttpRequest, HttpResponse, Responder,
};

use avail_rust::SDK;
use bigdecimal::BigDecimal;
use db::{models::credit_requests::CreditRequestInfo, schema::credit_requests::dsl::*};
use diesel::prelude::*;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection, RunQueryDsl};

use serde::{Deserialize, Serialize};
use serde_json::json;

/// Retrieve the status and details of a user's fund request.
///
/// # Description
/// This endpoint allows a user to retrieve the status and details of their fund request. The response includes information about the amount deposited, the amount of Avail approved, and the current status of the request.
///
/// # Route
/// `GET /user/request_fund_status`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request. The token should belong to the user whose fund request status is being queried.
///
/// # Returns
/// A JSON object with details about the fund request, including the request ID, user ID, token address, amounts deposited and approved, request status, and creation timestamp.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/user/request_fund_status" \
///      -H "Authorization: Bearer YOUR_TOKEN"
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "id": 1,
///   "user_id": "12345",
///   "token_address": "0x123abc456def789ghi",
///   "chain_id": 1,
///   "amount_token_deposited": "250",
///   "amount_avail_approved": "100000000000000000000", // scaled to 18 decimal places
///   "request_status": "pending",
///   "created_at": "2024-09-11T12:34:56"
/// }
/// ```

#[get("/request_fund_status")]
pub async fn request_funds_status(
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let tx: Vec<CreditRequestInfo> = credit_requests
        .filter(db::schema::credit_requests::user_id.eq(user))
        .select(CreditRequestInfo::as_select())
        .load(&mut *connection)
        .await
        .expect("Error loading users");

    HttpResponse::Ok().json(json!({"requests": tx}))
}

#[derive(Deserialize, Serialize, Clone)]
struct PurchaseCostParams {
    pub data_size: u128, // in bytes
}

#[get("/purchase_cost")]
pub async fn purchase_cost(
    query: web::Query<PurchaseCostParams>,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let sdk = generate_avail_sdk(&Arc::new(config.avail_rpc_endpoint.clone())).await;
    let account = SDK::alice().unwrap();

    let convertor = Convertor::new(&sdk, &account);

    let credits_cost = convertor
        .get_gas_price_for_data(convertor.one_kb.clone())
        .await;

    let credits_cost = credits_cost * BigDecimal::from(query.0.data_size as u128);

    HttpResponse::Ok().json(json!({"credits_cost": credits_cost}))
}

#[derive(Deserialize, Serialize, Clone)]
pub struct EstimateCreditsParams {
    pub data: BigDecimal,
}

#[get("/estimate_credits")]
pub async fn estimate_credits(
    query: web::Query<EstimateCreditsParams>,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let sdk = generate_avail_sdk(&Arc::new(config.avail_rpc_endpoint.clone())).await;
    let account = SDK::alice().unwrap();

    let convertor = Convertor::new(&sdk, &account);

    let credits_cost = convertor
        .calculate_credit_utlisation(query.0.data.to_string().as_bytes().to_vec())
        .await;

    HttpResponse::Ok().json(json!({"credits_cost": credits_cost}))
}

#[get("/estimate_credits_for_bytes")]
pub async fn estimate_credits_for_bytes(
    request_payload: Bytes,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let sdk = generate_avail_sdk(&Arc::new(config.avail_rpc_endpoint.clone())).await;
    let account = SDK::alice().unwrap();

    let convertor = Convertor::new(&sdk, &account);

    let credits_cost = convertor
        .calculate_credit_utlisation(request_payload.to_vec())
        .await;

    HttpResponse::Ok().json(json!({"credits_cost": credits_cost}))
}

/// Retrieve the list of supported tokens and their corresponding addresses.
///
/// # Description
/// This endpoint provides a list of supported tokens along with their addresses. It helps clients understand which tokens are available for interactions and their associated addresses on the blockchain.
///
/// # Route
/// `GET /token_map`
///
/// # Returns
/// A JSON object containing a mapping of token names to their addresses. The response provides a list of supported tokens with their respective blockchain addresses.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/token_map"
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "ethereum": "0xc...",  // Ethereum token address
///   "cardano": "0xd..."    // Cardano token address
/// }
/// ```

#[get("/token_map")]
pub async fn get_token_map() -> impl Responder {
    HttpResponse::Ok().json(json!({
        "token_map": &*TOKEN_MAP,
    }))
}

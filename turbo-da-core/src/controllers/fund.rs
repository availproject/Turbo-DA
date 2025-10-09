use crate::{
    config::AppConfig,
    utils::{
        generate_avail_sdk, get_amount_to_be_credited, get_connection, retrieve_user_id_from_jwt,
        Convertor, TOKEN_MAP,
    },
};
use actix_web::{
    get, post,
    web::{self, Bytes},
    HttpRequest, HttpResponse, Responder,
};
use avail_rust::constants::dev_accounts;
use bigdecimal::BigDecimal;
use db::controllers::fund::{create_credit_request, get_fund_status, update_inclusion_details};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

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
/// Parameters for adding inclusion details to a transaction
///
/// # Fields
/// * `order_id` - The ID of the order to update
/// * `tx_hash` - The transaction hash to associate with the order
#[derive(Deserialize, Serialize, Clone)]
struct AddInclusionDetailsParams {
    pub order_id: i32,
    pub tx_hash: String,
}

/// Add inclusion details to a transaction
///
/// # Description
/// This endpoint allows a user to add inclusion details (transaction hash) to an existing order.
/// The details are updated in the database for the specified order.
///
/// # Route
/// `POST /v1/user/add_inclusion_details`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request
///
/// # Request Body
/// * `order_id` - The ID of the order to update
/// * `tx_hash` - The transaction hash to associate with the order
///
/// # Returns
/// * Success: JSON response with status "success" and the updated transaction data
/// * Error: Internal server error with appropriate error message
#[post("/add_inclusion_details")]
pub async fn add_inclusion_details(
    payload: web::Json<AddInclusionDetailsParams>,
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

    let tx = update_inclusion_details(user, payload.0.order_id, payload.0.tx_hash, &mut connection)
        .await;

    match tx {
        Ok(tx) => HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Inclusion details added successfully", "data": tx})),
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

/// Query parameters for retrieving fund requests with optional filters
#[derive(Deserialize, Serialize)]
struct GetAllFundRequestsParams {
    /// Optional limit on number of results to return
    limit: Option<i64>,
    /// Optional user ID to filter results by
    user_id: Option<String>,
    /// Optional app ID to filter results by
    app_id: Option<Uuid>,
}

/// Retrieve a list of all fund transactions with optional filtering
///
/// # Description
/// This endpoint retrieves fund transactions with optional filtering by user ID and app ID.
/// The transactions are fetched from the database and returned in a structured format.
///
/// # Route
/// `GET /v1/admin/get_all_fund_requests`
///
/// # Query Parameters
/// * `limit` - Optional limit on number of results to return
/// * `user_id` - Optional user ID to filter results by
/// * `app_id` - Optional app ID to filter results by
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication (requires admin role)
///
/// # Returns
/// * 200 OK with a list of fund transactions if successful
/// * 500 Internal Server Error if database errors occur
///
/// # Example Request
/// ```bash
/// curl -X GET "https://api.example.com/v1/admin/get_all_fund_requests?limit=10&user_id=user@example.com" \
///      -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
/// ```
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
#[get("/get_all_fund_requests")]
pub async fn get_all_fund_requests(
    payload: web::Query<GetAllFundRequestsParams>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let tx = db::controllers::fund::get_all_fund_requests(
        &payload.user_id,
        &payload.app_id,
        &mut connection,
    )
    .await;
    match tx {
        Ok(tx) => HttpResponse::Ok().json(
            json!({"state": "SUCCESS", "message": "Fund list retrieved successfully", "data": tx}),
        ),
        Err(e) => {
            HttpResponse::InternalServerError().json(json!({ "state": "ERROR", "message": e}))
        }
    }
}

/// Request payload for funding a user's account
///
/// # Description
/// Parameters required to fund a user's account with credits
///
/// # Example Request
/// ```bash
/// curl -X POST "https://api.example.com/v1/admin/fund_user" \
///      -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
///      -H "Content-Type: application/json" \
///      -d '{
///        "user_id": "user@example.com",
///        "amount": "100.00"
///      }'
/// ```
#[derive(Deserialize, Serialize, Clone)]
pub struct FundUserParams {
    /// The ID of the user to fund
    pub user_id: String,
    /// The amount of credits to add to the user's account
    pub amount: BigDecimal,
}

/// Fund a user's account with credits
///
/// # Description
/// This endpoint allows admins to add credits to a user's account
///
/// # Route
/// `POST /v1/admin/fund_user`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication (requires admin privileges)
/// * `Content-Type: application/json`
///
/// # Request Body
/// * `user_id` - The ID of the user to fund
/// * `amount` - The amount of credits to add
///
/// # Returns
/// JSON response indicating success or failure
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Funds Granted Successfully",
///   "data": {
///     "user_id": "user@example.com",
///     "amount": "100.00"
///   }
/// }
/// ```
#[post("/fund_user")]
pub async fn fund_user(
    payload: web::Json<FundUserParams>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let tx =
        db::controllers::users::fund_user(&mut connection, &payload.user_id, &payload.amount).await;
    match tx {
        Ok(tx) => HttpResponse::Ok()
            .json(json!({"state": "SUCCESS", "message": "Funds Granted Successfully", "data": tx})),
        Err(e) => {
            HttpResponse::InternalServerError().json(json!({ "state": "ERROR", "message": e}))
        }
    }
}

#[derive(Deserialize, Serialize, Clone)]
struct RequestFundsStatusParams {
    pub id: i32,
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
    query: web::Query<RequestFundsStatusParams>,
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

    let tx = get_fund_status(user, query.0.id, &mut connection).await;
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
    let account = dev_accounts::alice();

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
    let account = dev_accounts::alice();

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
    let account = dev_accounts::alice();

    let convertor = Convertor::new(&sdk, &account);

    let credits_cost = convertor
        .calculate_credit_utlisation(request_payload.to_vec())
        .await;

    HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Credit cost calculated successfully", "data": credits_cost}))
}
/// Structure for estimating credits based on data size
///
/// # Fields
/// * `size` - The size of data in bytes for which to estimate credit requirements
#[derive(Deserialize, Serialize, Clone)]
pub struct EstimateCreditsSize {
    pub size: u64, // in Bytes
}

/// Estimate the credits required for a specific data size.
///
/// # Description
/// This endpoint calculates the credit cost for submitting data of a specified size to the Avail network.
///
/// # Route
/// `GET /v1/user/estimate_credits_against_size?size={size}`
///
/// # Query Parameters
/// * `size` - The size of data in bytes for which to estimate credit requirements.
///
/// # Returns
/// A JSON object containing the estimated credit cost for the specified data size.
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
#[get("/estimate_credits_against_size")]
pub async fn estimate_credits_against_size(
    query: web::Query<EstimateCreditsSize>,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let sdk = generate_avail_sdk(&Arc::new(config.avail_rpc_endpoint.clone())).await;
    let account = dev_accounts::alice();

    let convertor = Convertor::new(&sdk, &account);

    let vec = vec![0; query.0.size as usize];

    let credits_cost = convertor.calculate_credit_utlisation(vec).await;

    HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Credit cost calculated successfully", "data": credits_cost}))
}

#[derive(Deserialize, Serialize, Clone)]
pub struct EstimateCreditsToken {
    pub amount: BigDecimal,
    pub token_address: String,
    pub chain_id: u64,
}

/// Estimate the credits equivalent for a given token amount.
///
/// # Description
/// This endpoint calculates how many credits can be obtained for a specified amount of a particular token.
///
/// # Route
/// `GET /v1/user/estimate_credits_against_token?amount={amount}&token_address={address}&chain_id={chain_id}`
///
/// # Query Parameters
/// * `amount` - The amount of the token to convert to credits.
/// * `token_address` - The blockchain address of the token to convert from.
/// * `chain_id` - The blockchain ID of the token to convert from.
///
/// # Returns
/// A JSON object containing the estimated credit equivalent for the specified token amount.
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

#[get("/estimate_credits_against_token")]
pub async fn estimate_credits_against_token(
    query: web::Query<EstimateCreditsToken>,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let amount = get_amount_to_be_credited(
        &config.coingecko_api_url,
        &config.coingecko_api_key,
        &config.avail_rpc_endpoint.first().unwrap(),
        &query.0.chain_id,
        &query.0.token_address,
        &query.0.amount,
    )
    .await;

    match amount {
        Ok(amount) => HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Credit cost calculated successfully", "data": amount})),
        Err(e) => HttpResponse::InternalServerError().json(json!({"state": "ERROR", "message": e})),
    }
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
///     "11155111": {
///       "ethereum": {
///         "token_address": "0xc...",
///         "other_properties": "..."
///       },
///       "avail": {
///         "token_address": "0xd...",
///         "other_properties": "..."
///       }
///     },
///     "84532": {
///       "ethereum": {
///         "token_address": "0xc...",
///         "other_properties": "..."
///       },
///       "avail": {
///         "token_address": "0xd...",
///         "other_properties": "..."
///       }
///     }
///   }
///     }
///   }
///   }
/// }
/// ```

#[get("/token_map")]
pub async fn get_token_map() -> impl Responder {
    HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Token map retrieved successfully", "data": &*TOKEN_MAP}))
}

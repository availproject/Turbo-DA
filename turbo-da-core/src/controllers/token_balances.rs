use crate::{
    config::AppConfig,
    db::token_balances::{get_all_token_balances, get_all_token_balances_with_chain_id},
    utils::{get_connection, is_valid_ethereum_address, retrieve_user_id, TOKEN_MAP},
};
use actix_web::{get, post, web, HttpRequest, HttpResponse, Responder};
use bigdecimal::BigDecimal;
use db::{
    models::token_balances::{TokenBalances, TokenBalancesCreate},
    schema::token_balances::dsl::*,
};
use diesel::{prelude::*, result::Error};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::json;
use validator::Validate;

#[derive(Deserialize, Serialize)]
struct GetAllTokens {
    limit: Option<i64>,
}

#[derive(Deserialize, Serialize, Validate)]
struct GetToken {
    token_details_id: i32,
}

#[derive(Deserialize, Serialize, Validate)]
struct GetTokenUsingAddress {
    #[validate(custom(function = "is_valid_ethereum_address"))]
    token_address: String,
}

/// Retrieves details about all tokens associated with a user.
///
/// # Description
/// This function retrieves a list of tokens for a user, with the number of tokens limited by the `limit` query parameter. The request must be authenticated via a Bearer token.
///
/// # Route
/// `GET /user/get_all_tokens`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request.
///
/// # URL Parameters
/// * `limit` (required) - The maximum number of tokens to retrieve. This parameter controls the pagination of the result set.
///
/// # Returns
/// An `HttpResponse` containing a JSON array of token details. Each token object includes the token's ID, associated user ID, token address, and token balance. If the request fails or no tokens are found, an appropriate error response will be returned.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/user/get_all_tokens?limit=10" \
///      -H "Authorization: Bearer YOUR_TOKEN"
/// ```
///
/// # Example Response
///
/// ```json
/// [
///   {
///     "token_details_id": 1,
///     "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
///     "token_address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
///     "token_balance": "100000000000000000000"
///   },
///   {
///     "token_details_id": 2,
///     "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
///     "token_address": "0xc0bbb3139b223fe8d0a0e5c4f27ead9083c756cc2",
///     "token_balance": "100000000000000000000"
///   }
/// ]
/// ```

#[get("/get_all_tokens")]
pub async fn get_all_tokens(
    payload: web::Query<GetAllTokens>,
    config: web::Data<AppConfig>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let limit = payload.limit;
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

    let results = get_all_token_balances(&mut *connection, user, final_limit).await;
    HttpResponse::Ok().json(json!({"results":results}))
}

#[derive(Serialize)]
pub struct CombinedTokenInfo {
    pub token_details_id: i32,
    pub user_id: String,
    pub token_address: String,
    pub token_balance: BigDecimal,
    pub chain_id: Option<i32>,
}

/// Retrieves details about all tokens associated with a user.
///
/// # Description
/// This function retrieves a list of tokens for a user, with the number of tokens limited by the `limit` query parameter. The request must be authenticated via a Bearer token.
///
/// # Route
/// `GET /user/get_all_tokens`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request.
///
/// # URL Parameters
/// * `limit` (required) - The maximum number of tokens to retrieve. This parameter controls the pagination of the result set.
///
/// # Returns
/// An `HttpResponse` containing a JSON array of token details. Each token object includes the token's ID, associated user ID, token address, and token balance. If the request fails or no tokens are found, an appropriate error response will be returned.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/user/get_all_tokens?limit=10" \
///      -H "Authorization: Bearer YOUR_TOKEN"
/// ```
///
/// # Example Response
///
/// ```json
/// [
///   {
///     "token_details_id": 1,
///     "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
///     "token_address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
///     "token_balance": "100000000000000000000",
///     "chain_id": 1
///   },
///   {
///     "token_details_id": 2,
///     "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
///     "token_address": "0xc0bbb3139b223fe8d0a0e5c4f27ead9083c756cc2",
///     "token_balance": "100000000000000000000",
///     "chain_id": 1
///   }
/// ]
/// ```

#[get("/get_all_tokens_with_chain_id")]
pub async fn get_all_tokens_with_chain_id(
    payload: web::Query<GetAllTokens>,
    config: web::Data<AppConfig>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let limit = payload.limit;
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

    let results = get_all_token_balances_with_chain_id(&mut *connection, user, final_limit).await;

    HttpResponse::Ok().json(results)
}

/// Retrieves details about a specific token associated with a user.
///
/// # Description
/// This function retrieves detailed information about a specific token using its `token_details_id`. The request must be authenticated via a Bearer token.
///
/// # Route
/// `GET /user/get_token`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request.
///
/// # URL Parameters
/// * `token_details_id` (required) - The unique identifier of the token as registered in the Token Details DB table.
///
/// # Returns
/// An `HttpResponse` containing a JSON object with the token's details, including the token address and balance, or an error message if the token is not found.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/user/get_token?token_details_id=1" \
///      -H "Authorization: Bearer YOUR_TOKEN"
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "token_details_id": 1,
///   "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
///   "token_address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
///   "token_balance": "100000000000000000000"
/// }
/// ```

#[get("/get_token")]
pub async fn get_token(
    payload: web::Query<GetToken>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let token_id = payload.token_details_id;
    handle_gettoken_query(&mut connection, token_id).await
}

/// Retrieves details about a token using its address.
///
/// # Description
/// This function retrieves detailed information about a specific token using its address. The request must be authenticated via a Bearer token.
///
/// # Route
/// `GET /user/get_token_using_address`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request.
///
/// # URL Parameters
/// * `token_address` (required) - The address of the token for which details are being retrieved.
///
/// # Returns
/// An `HttpResponse` containing a JSON object with the token's details, including the token's ID, associated user ID, token address, and balance, or an error message if the token is not found.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/user/get_token_using_address?token_address=0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" \
///      -H "Authorization: Bearer YOUR_TOKEN"
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "token_details_id": 1,
///   "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
///   "token_address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
///   "token_balance": "100000000000000000000"
/// }
/// ```

#[get("/get_token_using_address")]
pub async fn get_token_using_address(
    payload: web::Query<GetTokenUsingAddress>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let token_address_value = &payload.token_address;
    handle_get_token_using_address_query(&mut connection, token_address_value).await
}

#[derive(Deserialize, Serialize)]
pub(crate) struct RegisterToken {
    pub(crate) token: String,
}

/// Registers a new token for a user.
///
/// # Description
/// This function registers a new token by adding its address to the user's list of subscribed tokens. The request must be authenticated via a Bearer token.
///
/// # Route
/// `POST /user/register_new_token`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request.
/// * `Content-Type: application/json` - Indicates that the request body is in JSON format.
///
/// # Body Parameters
/// * `token_address` (required) - The address of the token that the user wants to subscribe to. This address must be whitelisted.
///
/// # Returns
/// An `HttpResponse` containing a JSON object with the details of the newly registered token, including the token's ID, associated user ID, token address, and initial balance. If the registration fails, an appropriate error message will be returned.
///
/// # Example Request
///
/// ```bash
/// curl -X POST "https://api.example.com/v1/user/register_new_token" \
///      -H "Authorization: Bearer YOUR_TOKEN" \
///      -H "Content-Type: application/json" \
///      -d '{
///            "token": "ethereum"
///          }'
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "token_details_id": 1,
///   "user_id": "user_2lO5zzxhV08hooYiSCOkfWfPxls",
///   "token_address": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
///   "token_balance": "100000000000000000000"
/// }
/// ```

#[post("/register_new_token")]
pub async fn register_new_token(
    request_payload: web::Json<RegisterToken>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };
    let user = match retrieve_user_id(http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let token_details = match TOKEN_MAP.get(&request_payload.token) {
        Some(details) => details,
        None => return HttpResponse::InternalServerError().body("Token Address Invalid"),
    };
    let converted_token_address = token_details.token_address.clone();

    if token_already_registered(&mut connection, &user, &converted_token_address)
        .await
        .is_ok_and(|exists| exists)
    {
        return HttpResponse::Conflict().body("Token already exists");
    }

    let tx = diesel::insert_into(token_balances)
        .values(TokenBalancesCreate {
            token_address: converted_token_address,
            token_balance: BigDecimal::from(0), // we fund the wallets
            user_id: user.clone(),
            token_used: None,
        })
        .execute(&mut *connection)
        .await;

    match tx {
        Ok(_) => HttpResponse::Ok().body(format!(
            "Success: user: {}, token: {}",
            user, request_payload.token
        )),
        Err(e) => HttpResponse::NotAcceptable().body(format!("Error: {}", e)),
    }
}

async fn handle_get_token_using_address_query(
    connection: &mut AsyncPgConnection,
    token: &String,
) -> HttpResponse {
    match token_balances
        .filter(token_address.eq(token))
        .select(TokenBalances::as_select())
        .first::<TokenBalances>(connection)
        .await
    {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(Error::NotFound) => HttpResponse::NotFound().body("User not found"),
        Err(_) => HttpResponse::InternalServerError().body("Database error"),
    }
}

async fn handle_gettoken_query(connection: &mut AsyncPgConnection, token: i32) -> HttpResponse {
    match token_balances
        .filter(token_details_id.eq(token))
        .select(TokenBalances::as_select())
        .first::<TokenBalances>(connection)
        .await
    {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(Error::NotFound) => HttpResponse::NotFound().body("User not found"),
        Err(_) => HttpResponse::InternalServerError().body("Database error"),
    }
}

async fn token_already_registered(
    connection: &mut AsyncPgConnection,
    _user_id: &String,
    _token_address: &String,
) -> Result<bool, Error> {
    diesel::select(diesel::dsl::exists(
        token_balances
            .filter(user_id.eq(_user_id))
            .filter(token_address.eq(_token_address)),
    ))
    .get_result(connection)
    .await
}

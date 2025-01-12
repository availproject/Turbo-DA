use std::str::FromStr;

use crate::{
    config::AppConfig,
    utils::{get_connection, retrieve_user_id, TOKEN_MAP},
};
use actix_web::{get, post, web, HttpRequest, HttpResponse, Responder};
use bigdecimal::BigDecimal;
use db::{
    models::{fund::FundRequestsGet, signer_nonce::SignerNonce, token_balances::TokenBalances},
    schema::{fund_requests::dsl::*, signer_nonce::dsl::*, token_balances::dsl::*},
};
use diesel::prelude::*;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection, RunQueryDsl};
use log::{error, info, warn};

use serde::{Deserialize, Serialize};
use serde_json::json;

use alloy::{
    primitives::{keccak256, Address, Bytes, U256},
    signers::{local::PrivateKeySigner, SignerSync},
    sol,
    sol_types::SolValue,
};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    TurboDAResolver,
    "../contracts/out/TurboDAResolver.sol/TurboDAResolver.json"
);

sol! {
    struct Encoder{bytes userID; address tokenAddress; uint256 amount; address recipient; uint256 nonce;}
}

#[derive(Deserialize, Serialize, Clone)]
struct TransferFunds {
    fund_id: i32,
}

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
    let user = match retrieve_user_id(http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let tx = fund_requests
        .filter(db::schema::fund_requests::user_id.eq(user))
        .select(FundRequestsGet::as_select())
        .load(&mut *connection)
        .await
        .expect("Error loading users");

    HttpResponse::Ok().json(json!({"requests": tx}))
}
/// Represents the request payload for generating a signature for fund retrieval
///
/// # Fields
/// * `token` - The token identifier/symbol
/// * `amount` - The amount of tokens to retrieve
/// * `wallet_address` - The wallet address to send the funds to
#[derive(Deserialize, Serialize, Clone)]
struct GenerateSignatureForFundRetrieval {
    token: String,
    amount: BigDecimal,
    wallet_address: String,
}

/// Generates a signature for retrieving funds from the system
///
/// # Description
/// This endpoint generates a cryptographic signature that authorizes the withdrawal
/// of funds from the user's balance. The signature can be used to prove authorization
/// when making the actual withdrawal transaction.
///
/// # Route
/// `POST /generate_signature_for_fund_retrieval`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request
///
/// # Request Body
/// ```json
/// {
///   "token": "ETH",
///   "amount": "1.5",
///   "wallet_address": "0x123..."
/// }
/// ```
///
/// # Returns
/// A signature that can be used to authorize the fund withdrawal if successful,
/// or an error response if the request fails (e.g., insufficient balance)
#[post("/generate_signature_for_fund_retrieval")]
pub async fn generate_signature_for_fund_retrieval(
    payload: web::Json<GenerateSignatureForFundRetrieval>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let user = match retrieve_user_id(http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let address = TOKEN_MAP.get(&payload.token).unwrap();
    let query = token_balances
        .filter(db::schema::token_balances::user_id.eq(&user))
        .filter(db::schema::token_balances::token_address.eq(&address.token_address.to_lowercase()))
        .select(TokenBalances::as_select())
        .first(&mut *connection)
        .await;

    match query {
        Ok(result) => {
            let amount_available =
                &result.token_balance - &result.token_amount_locked - &result.token_used;
            if &amount_available < &payload.amount {
                return HttpResponse::BadRequest().body("Insufficient balance");
            }

            let amount = &payload.amount;

            let private_key = match PrivateKeySigner::from_str(&config.signing_key) {
                Ok(key) => key,
                Err(e) => {
                    warn!("Error parsing signing key: {}", e);
                    return HttpResponse::InternalServerError().body(e.to_string());
                }
            };

            let nonce = match signer_nonce
                .filter(signer_address.eq(private_key.address().to_string().to_lowercase()))
                .select(SignerNonce::as_select())
                .first(&mut *connection)
                .await
            {
                Ok(nonce) => nonce,
                Err(e) => {
                    warn!("Error fetching signer nonce: {}", e);
                    return HttpResponse::InternalServerError().body(e.to_string());
                }
            };

            let signature = match generate_signature(
                &address.token_address,
                &amount,
                &user,
                nonce.last_nonce,
                &payload.wallet_address,
                &config,
            )
            .await
            {
                Ok(signature) => {
                    let updated_rows = diesel::update(signer_nonce)
                        .filter(signer_address.eq(private_key.address().to_string().to_lowercase()))
                        .set(db::schema::signer_nonce::last_nonce.eq(nonce.last_nonce + 1))
                        .execute(&mut *connection)
                        .await;

                    match updated_rows {
                        Ok(_) => signature,
                        Err(e) => {
                            warn!("Error updating signer nonce: {}", e);
                            return HttpResponse::InternalServerError().body(e.to_string());
                        }
                    }
                }
                Err(e) => {
                    warn!("Error generating signature: {}", e);
                    return HttpResponse::InternalServerError().body(e.to_string());
                }
            };
            match lock_fund_amount(
                &amount,
                &user,
                &address.token_address.to_lowercase(),
                &mut *connection,
            )
            .await
            {
                Ok(_) => HttpResponse::Ok().json(json!({"signature": signature, "nonce": nonce})),
                Err(e) => {
                    warn!("Error locking fund amount: {}", e);
                    return HttpResponse::InternalServerError().body(e.to_string());
                }
            }
        }
        Err(e) => {
            warn!("Error fetching token details: {}", e);
            return HttpResponse::InternalServerError().body(e.to_string());
        }
    }
}

async fn lock_fund_amount(
    amount: &BigDecimal,
    user: &String,
    address: &String,
    connection: &mut AsyncPgConnection,
) -> Result<(), String> {
    let updated_rows_query = diesel::update(
        db::schema::token_balances::table
            .filter(db::schema::token_balances::token_address.eq(&address))
            .filter(db::schema::token_balances::user_id.eq(&user)),
    )
    .set(
        db::schema::token_balances::token_amount_locked
            .eq(db::schema::token_balances::token_amount_locked + amount),
    )
    .execute(connection)
    .await;

    let updated_rows = updated_rows_query.unwrap_or_else(|_| {
        error!("Update token balances query failed");
        0
    });

    if updated_rows > 0 {
        info!(
            "Successfully updated token balances with token address {} with amount {}",
            address, amount
        );
        Ok(())
    } else {
        error!("No rows updated for token address: {}", address);
        Err(format!("No rows updated for token address: {}", address))
    }
}

async fn generate_signature(
    address: &String,
    amount: &BigDecimal,
    user: &String,
    nonce: i32,
    wallet_address: &String,
    config: &web::Data<AppConfig>,
) -> Result<String, String> {
    let signer = PrivateKeySigner::from_str(config.signing_key.as_str()).unwrap();
    let user: Bytes = Bytes::from_str(hex::encode(user).as_str()).unwrap();
    let amount: U256 = U256::from(amount.to_string().parse::<u128>().unwrap());
    let token_addr: Address = Address::from_str(address.as_str()).unwrap();
    let nonce: U256 = U256::from(nonce);
    let recipient: Address = Address::from_str(wallet_address.as_str()).unwrap();

    let data = Encoder {
        userID: user,
        tokenAddress: token_addr,
        amount,
        recipient,
        nonce,
    };
    let abi_encoded = data.abi_encode_packed();
    let hash = keccak256(&abi_encoded);
    let signature = signer.sign_hash_sync(&hash);
    match signature {
        Ok(signature) => Ok(hex::encode(signature.as_bytes())),
        Err(e) => Err(e.to_string()),
    }
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

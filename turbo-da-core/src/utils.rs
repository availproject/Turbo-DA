/// A collection of utils
/// - Keygeneration
/// - Keylist generation
use actix_web::{
    web::{self},
    HttpMessage, HttpRequest, HttpResponse,
};
use alloy::primitives::Address;
use avail_rust::{prelude::alice, Client as SDK, Keypair, Options};

use crate::logger::{debug_json, error, info};
use bigdecimal::BigDecimal;
use clerk_rs::validators::authorizer::ClerkJwt;
use diesel_async::{
    pooled_connection::deadpool::{Object, Pool},
    AsyncPgConnection,
};
use lazy_static::lazy_static;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    collections::{Bound, HashMap},
    str::FromStr,
    sync::Arc,
};
use tokio::time::{sleep, Duration};
use uuid::Uuid;
use validator::ValidationError;

/// Generates a list of keypairs from provided private keys
///
/// # Arguments
/// * `number_of_threads` - Number of keypairs to generate
/// * `private_keys` - Array of private key strings to generate keypairs from
pub async fn generate_keygen_list(number_of_threads: i32, private_keys: &[String]) -> Vec<Keypair> {
    let mut keypairs = Vec::new();

    for i in 0..number_of_threads {
        keypairs.push(create_keypair(&private_keys[i as usize]));
    }

    keypairs
}

/// Creates a keypair from a private key string
///
/// # Arguments
/// * `private_key` - Private key as a hex string
pub fn create_keypair(private_key: &String) -> Keypair {
    let bytes = hex::decode(private_key).expect("Failed to decode hex string");
    let byte_array: [u8; 32] = bytes.try_into().expect("Slice with incorrect length");
    Keypair::from_secret_key(byte_array)
        .unwrap_or_else(|_| panic!("Fatal: Couldn't parse the private key {:?}", private_key))
}

/// Formats a byte size into a human readable string with appropriate units
///
/// # Arguments
/// * `bytes` - Size in bytes to format
pub fn format_size(bytes: usize) -> String {
    const UNITS: [&str; 6] = ["B", "KB", "MB", "GB", "TB", "PB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    format!("{:.2} {}", size, UNITS[unit_index])
}

/// Generates a new UUID v4 for submission identification
pub fn generate_submission_id() -> Uuid {
    Uuid::new_v4()
}

/// Finds a token address by its key in the token map
///
/// # Arguments
/// * `key` - Token key to look up
pub fn find_key_by_value<'a>(chain: &'a u64, key: &'a String) -> Option<&'a String> {
    if let Some(token) = TOKEN_MAP.get(chain) {
        if let Some(token) = token.get(key) {
            Some(&token.token_address)
        } else {
            None
        }
    } else {
        None
    }
}

/// Validates if a string is a valid Ethereum address
///
/// # Arguments
/// * `address` - Address string to validate
pub fn is_valid_ethereum_address(address: &str) -> Result<(), ValidationError> {
    match Address::from_str(address) {
        Ok(_) => Ok(()),
        Err(_) => Err(ValidationError::new("Invalid Ethereum address")),
    }
}

/// Gets a database connection from the connection pool
///
/// # Arguments
/// * `pool` - Database connection pool
pub async fn get_connection(
    pool: &web::Data<Pool<AsyncPgConnection>>,
) -> Result<Object<AsyncPgConnection>, HttpResponse> {
    match pool.get().await {
        Ok(conn) => Ok(conn),
        Err(err) => {
            error(&format!("Failed to get a database connection: {}", err));
            return Err(HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "Database connection error"
            })));
        }
    }
}

/// Retrieves user ID from HTTP request headers
///
/// # Arguments
/// * `http_request` - HTTP request to extract user ID from
pub fn retrieve_user_id(http_request: &HttpRequest) -> Option<String> {
    let headers = http_request.headers();

    for (name, value) in headers.iter() {
        if name == "user_id" {
            if let Ok(user_id) = value.to_str() {
                return Some(user_id.to_string());
            }
        }
    }
    None
}
/// Retrieves user ID from JWT in HTTP request
///
/// # Arguments
/// * `http_request` - HTTP request containing JWT with user ID
///
/// # Returns
/// * `Option<String>` - User ID if found in JWT, None otherwise
pub fn retrieve_user_id_from_jwt(http_request: &HttpRequest) -> Option<String> {
    let jwt = http_request.extensions().get::<ClerkJwt>().cloned();
    if let Some(jwt) = jwt {
        jwt.other
            .get("user_email")
            .map(|id| id.to_string().trim_matches('"').to_string())
    } else {
        None
    }
}

/// Retrieves email address from HTTP request headers
///
/// # Arguments
/// * `http_request` - HTTP request to extract email from
pub fn retrieve_email_address(http_request: &HttpRequest) -> Option<String> {
    let headers = http_request.headers();

    for (name, value) in headers.iter() {
        if name == "user_email" {
            if let Ok(user_email) = value.to_str() {
                return Some(user_email.to_string());
            }
        }
    }
    None
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Price {
    pub btc: Option<f64>,
    pub btc_market_cap: Option<f64>,
    pub eth: Option<f64>,
    pub usd: Option<f64>,
}

/// Gets current prices for Avail and specified token from CoinGecko API
///
/// # Arguments
/// * `client` - HTTP client for making requests
/// * `coingecko_api_url` - CoinGecko API URL
/// * `coingecko_api_key` - CoinGecko API key
/// * `token` - Token to get price for
pub async fn get_prices(
    client: &Client,
    coingecko_api_url: &str,
    coingecko_api_key: &str,
    token: &str,
) -> Result<(f64, f64), String> {
    let params = [
        ("ids", format!("avail,{}", token)),
        ("vs_currencies", "usd".to_string()),
    ];

    let response = client
        .get(coingecko_api_url)
        .query(&params)
        .header("accept", "application/json")
        .header("x-cg-pro-api-key", coingecko_api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json = response
        .json::<HashMap<String, Price>>()
        .await
        .map_err(|e| e.to_string())?;

    let coin_price = match json.get(token) {
        Some(val) => val.usd.ok_or_else(|| price_not_found_error(token))?,
        None => {
            let msg = price_not_found_error(token);
            return Err(msg);
        }
    };

    let avail_price = match json.get("avail") {
        Some(val) => val.usd.ok_or_else(|| price_not_found_error("avail"))?,
        None => {
            let msg = price_not_found_error("avail");
            return Err(msg);
        }
    };

    Ok((coin_price, avail_price))
}

pub struct Convertor<'a> {
    pub sdk: &'a SDK,
    pub account: &'a Keypair,
    pub one_kb: Vec<u8>,
}

impl<'a> Convertor<'a> {
    pub fn new(sdk: &'a SDK, account: &'a Keypair) -> Self {
        Convertor {
            sdk,
            account,
            one_kb: vec![0u8; 1024],
        }
    }
    pub async fn get_gas_price_for_data(&self, data: Vec<u8>) -> BigDecimal {
        let tx = self.sdk.tx().data_availability().submit_data(data);

        let query_info = match tx.estimate_call_fees(None).await {
            Ok(info) => info,
            Err(e) => {
                error(&format!("Failed to get payment query info: {:?}", e));
                return BigDecimal::from(u128::MAX);
            }
        };
        BigDecimal::from(query_info.final_fee())
    }

    pub async fn calculate_credit_utlisation(&self, data: Vec<u8>) -> BigDecimal {
        let data_posted_amount = data.len() as u128;

        if data_posted_amount < self.one_kb.len() as u128 {
            return BigDecimal::from(self.one_kb.len() as u128);
        }

        // (1KB_fee / data_posted_fee) * data_posted_amount = data_billed
        let one_kb_fee = self.get_gas_price_for_data(self.one_kb.clone()).await;
        let data_posted_fee = self.get_gas_price_for_data(data).await;

        one_kb_fee / data_posted_fee * BigDecimal::from(data_posted_amount as u128)
    }
}

/// Token information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub token_address: String,
    pub token_decimals: u32,
}

lazy_static! {
    pub static ref TOKEN_MAP: HashMap<u64, HashMap<String, Token>> = {
        let mut m = HashMap::new();
        let mut chain_map = HashMap::new();
        chain_map.insert(
            "ethereum".to_string(),
            Token {
                token_address: "0x8b42845d23c68b845e262dc3e5caa1c9ce9edb44".to_string(),
                token_decimals: 18,
            },
        );
        chain_map.insert(
            "avail".to_string(),
            Token {
                token_address: "0x99a907545815c289fb6de86d55fe61d996063a94".to_string(),
                token_decimals: 18,
            },
        );
        m.insert(11155111, chain_map.clone());
        m.insert(84532, chain_map.clone());
        m
    };
}

const WAIT_TIME: u64 = 5;
pub async fn generate_avail_sdk(endpoints: &Arc<Vec<String>>) -> SDK {
    let mut attempts = 0;

    loop {
        if attempts < endpoints.len() {
            attempts = 0;
        }
        let endpoint = &endpoints[attempts];
        info(&format!("Attempting to connect endpoint: {:?}", endpoint));
        match SDK::new(endpoint).await {
            Ok(sdk) => {
                info(&format!("Connected successfully to endpoint: {}", endpoint));
                return sdk;
            }
            Err(e) => {
                error(&format!(
                    "Failed to connect to endpoint {}: {:?}",
                    endpoint, e
                ));
                attempts += 1;
            }
        }

        info(&format!(
            "All endpoints failed. Waiting 5 seconds before next retry...."
        ));
        sleep(Duration::from_secs(WAIT_TIME)).await;
    }
}

/// Retrieves user ID from HTTP request headers
///
/// # Arguments
/// * `http_request` - HTTP request to extract user ID from
pub fn retrieve_account_id(http_request: &HttpRequest) -> Option<Uuid> {
    let headers = http_request.headers();

    for (name, value) in headers.iter() {
        if name == "account_id" {
            if let Ok(account_id) = value.to_str() {
                return Uuid::parse_str(account_id).ok();
            }
        }
    }
    None
}

fn price_not_found_error(token: &str) -> String {
    format!("{:?} price not found from coingecho", token)
}

pub async fn calculate_avail_token_equivalent(
    coingecko_api_url: &str,
    coingecko_api_key: &str,
    token_amount: &BigDecimal,
    chain: &u64,
    token_address: &str,
) -> Result<BigDecimal, String> {
    let http_client = Client::new();

    debug_json(json!({
        "message": "Token Address",
        "token_address": token_address,
        "level": "debug"
    }));

    let token_symbol = TOKEN_MAP
        .iter()
        .find_map(|(chain_id, tokens)| {
            if chain_id == chain {
                tokens.iter().find_map(|(key, token)| {
                    if token.token_address == token_address {
                        Some(key.clone())
                    } else {
                        None
                    }
                })
            } else {
                None
            }
        })
        .ok_or_else(|| String::from("Token address not found in token mapping"))?;

    let (token_usd_price, avail_usd_price) = get_prices(
        &http_client,
        &coingecko_api_url,
        &coingecko_api_key,
        token_symbol.as_str(),
    )
    .await
    .map_err(|e| format!("Failed to fetch prices for {}: {}", token_symbol, e))?;

    debug_json(json!({
        "message": "Current Token USD price",
        "token_usd_price": token_usd_price,
        "level": "debug"
    }));
    debug_json(json!({
        "message": "Current AVAIL USD price",
        "avail_usd_price": avail_usd_price,
        "level": "debug"
    }));

    let token_avail_ratio = token_usd_price / avail_usd_price;
    let source_token_decimals = TOKEN_MAP
        .get(chain)
        .ok_or_else(|| String::from("Source Token address not found in token mapping"))?
        .get(token_symbol.as_str())
        .ok_or_else(|| String::from("Source Token address not found in token mapping"))?
        .token_decimals;
    let avail_token_decimals = TOKEN_MAP
        .get(chain)
        .ok_or_else(|| String::from("Avail Token address not found in token mapping"))?
        .get("avail")
        .ok_or_else(|| String::from("Avail Token address not found in token mapping"))?
        .token_decimals;
    let token_avail_ratio_decimal = BigDecimal::from_str(token_avail_ratio.to_string().as_str())
        .map_err(|e| format!("Failed to convert price ratio to decimal: {}", e))?;

    let equivalent_amount = token_avail_ratio_decimal
        * token_amount
        * BigDecimal::from(10_u64.pow(avail_token_decimals as u32))
        / BigDecimal::from(10_u64.pow(source_token_decimals as u32));

    Ok(equivalent_amount.round(0))
}

pub async fn get_amount_to_be_credited(
    coin_gecho_api_url: &String,
    coin_gecho_api_key: &String,
    avail_rpc_url: &String,
    chain: &u64,
    address: &String,
    amount: &BigDecimal,
) -> Result<BigDecimal, String> {
    let price = calculate_avail_token_equivalent(
        &coin_gecho_api_url,
        &coin_gecho_api_key,
        &amount,
        &chain,
        &address,
    )
    .await
    .map_err(|e| format!("Failed to get price for {}: {}", address, e))?;

    let client = SDK::new(avail_rpc_url)
        .await
        .map_err(|e| format!("Failed to create SDK client: {:?}", e))?;

    let account = alice();
    let converter = Convertor::new(&client, &account);
    let price_per_kb = converter
        .get_gas_price_for_data(converter.one_kb.clone())
        .await;

    Ok((price / price_per_kb * BigDecimal::from(converter.one_kb.len() as u128)).round(3))
}

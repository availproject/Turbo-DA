/// A collection of utils
/// - Keygeneration
/// - Keylist generation
use crate::{config::AppConfig, store::Price};
use actix_web::{
    web::{self},
    HttpRequest, HttpResponse,
};
use alloy::primitives::Address;
use avail_rust::{Keypair, Options, SDK};

use bigdecimal::BigDecimal;
use diesel_async::{
    pooled_connection::deadpool::{Object, Pool},
    AsyncPgConnection,
};
use lazy_static::lazy_static;
use log::{error, info};
use rand::Rng;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashMap, str::FromStr, sync::Arc};
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
pub fn find_key_by_value(key: &String) -> Option<&String> {
    if let Some(token) = TOKEN_MAP.get(key) {
        Some(&token.token_address)
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
            error!("Failed to get a database connection: {}", err);
            Err(HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Database connection error"
            })))
        }
    }
}

/// Retrieves user ID from HTTP request headers
///
/// # Arguments
/// * `http_request` - HTTP request to extract user ID from
pub fn retrieve_user_id(http_request: HttpRequest) -> Option<String> {
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

    let response = match client
        .get(coingecko_api_url)
        .query(&params)
        .header("accept", "application/json")
        .header("x-cg-pro-api-key", coingecko_api_key)
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(e) => {
            return Err(e.to_string());
        }
    };

    let json = match response.json::<HashMap<String, Price>>().await {
        Ok(j) => j,
        Err(e) => {
            return Err(e.to_string());
        }
    };

    let coin_price = match json.get(token) {
        Some(val) => match val.usd {
            Some(coin_price) => coin_price,
            None => {
                let msg = format!("{:?} price not found from coingecho", token);

                return Err(msg);
            }
        },
        None => {
            let msg = format!("{:?} price not found from coingecho", token);
            return Err(msg);
        }
    };

    let avail_price = match json.get("avail") {
        Some(val) => match val.usd {
            Some(avail_price) => avail_price,
            None => {
                let msg = "Avail price not found from coingecho".to_string();

                return Err(msg);
            }
        },
        None => {
            let msg = "Avail price not found from coingecho".to_string();

            return Err(msg);
        }
    };

    Ok((coin_price, avail_price))
}

pub struct Convertor<'a> {
    pub(crate) sdk: &'a SDK,
    pub(crate) account: &'a Keypair,
    pub(crate) one_kb: Vec<u8>,
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
        let tx = self.sdk.tx.data_availability.submit_data(data);

        let options = Options::new();
        let query_info = match tx.payment_query_info(self.account, Some(options)).await {
            Ok(info) => info,
            Err(e) => panic!("Failed to get payment query info: {:?}", e),
        };
        BigDecimal::from(query_info)
    }

    pub async fn calculate_credit_utlisation(&self, data: Vec<u8>) -> BigDecimal {
        // (1KB_fee / data_posted_fee) * data_posted_amount = data_billed
        let data_posted_amount = data.len() as u128;

        let one_kb_fee = self.get_gas_price_for_data(self.one_kb.clone()).await;
        let data_posted_fee = self.get_gas_price_for_data(data).await;

        one_kb_fee / data_posted_fee * BigDecimal::from(data_posted_amount as u128)
    }

    pub fn convert_avail_price_to_token(self, avail_price: BigDecimal, token: &str) -> BigDecimal {
        // TODO: Implement this function
        BigDecimal::from(0)
    }
}

/// Token information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub token_address: String,
    pub token_decimals: u32,
}

lazy_static! {
    pub static ref TOKEN_MAP: HashMap<String, Token> = {
        let mut m = HashMap::new();
        m.insert(
            "avail".to_string(),
            Token {
                token_address: "0x99a907545815c289fb6de86d55fe61d996063a94".to_string(),
                token_decimals: 18,
            },
        );
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
        info!("Attempting to connect endpoint: {:?}", endpoint);
        match SDK::new(endpoint).await {
            Ok(sdk) => {
                info!("Connected successfully to endpoint: {}", endpoint);

                return sdk;
            }
            Err(e) => {
                error!("Failed to connect to endpoint {}: {:?}", endpoint, e);
                attempts += 1;
            }
        }

        info!("All endpoints failed. Waiting 5 seconds before next retry....");
        sleep(Duration::from_secs(WAIT_TIME)).await;
    }
}

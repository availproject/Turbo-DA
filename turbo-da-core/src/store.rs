use crate::utils::{get_prices, TOKEN_MAP};
use bigdecimal::BigDecimal;
use log::{error, info};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone)]
pub struct CoinGeckoStore {
    pub store: Arc<RwLock<HashMap<String, f64>>>,
}

impl CoinGeckoStore {
    pub fn new() -> Self {
        Self {
            store: Arc::new(RwLock::new({
                let mut map = HashMap::new();
                map.insert("ethereum".to_string(), 3600.0);
                map.insert("avail".to_string(), 0.2);
                map
            })),
        }
    }
    pub async fn get_avail_price(&self) -> f64 {
        let store = self.store.read().unwrap();
        let price = store.get("avail").unwrap();
        price.clone()
    }
    pub fn get_token_price(&self, token_name: &str) -> f64 {
        let store = self.store.read().unwrap();
        let price = store.get(token_name).unwrap();
        price.clone()
    }

    pub fn get_avail_price_per_token(&self, token_name: &str) -> f64 {
        let store = self.store.read().unwrap();
        let token_price = store.get(token_name).unwrap();
        let avail_price = store.get("avail").unwrap();
        let price = avail_price / token_price;

        price.clone()
    }
    pub fn get_token_price_per_avail(&self, token_name: &str) -> f64 {
        let store = self.store.read().unwrap();
        let token_price = store.get(token_name).unwrap();
        let avail_price = store.get("avail").unwrap();
        let price = token_price / avail_price;

        price.clone()
    }

    pub fn update_token_price(&self, token_name: &str, price: f64) {
        let mut store = self.store.write().unwrap();
        store.insert(token_name.to_string(), price);
    }

    pub fn update_avail_price(&self, price: f64) {
        let mut store = self.store.write().unwrap();
        store.insert("avail".to_string(), price);
    }

    pub fn get_token_price_equivalent_to_avail(
        &self,
        amount: &BigDecimal,
        token_name: &str,
    ) -> BigDecimal {
        let avail_price_per_token = self.get_avail_price_per_token(token_name);
        let decimals_token = TOKEN_MAP.get(token_name).unwrap().token_decimals;
        let decimals_avail = TOKEN_MAP.get("avail").unwrap().token_decimals;
        let avail_price_per_token_bigdecimal =
            match BigDecimal::from_str(avail_price_per_token.to_string().as_str()) {
                Ok(amount) => amount,
                Err(e) => {
                    error!("Failed to parse amount to BigDecimal: {}", e);
                    return BigDecimal::from(0);
                }
            };

        let price = avail_price_per_token_bigdecimal
            * amount
            * BigDecimal::from(10_u64.pow(decimals_token as u32))
            / BigDecimal::from(10_u64.pow(decimals_avail as u32));

        price.round(0)
    }

    pub fn get_avail_price_equivalent_to_token(
        &self,
        amount: &BigDecimal,
        token_name: &str,
    ) -> BigDecimal {
        let token_price_per_avail = self.get_token_price_per_avail(token_name);
        let decimals_token = TOKEN_MAP.get(token_name).unwrap().token_decimals;
        let decimals_avail = TOKEN_MAP.get("avail").unwrap().token_decimals;
        let token_price_per_avail_bigdecimal =
            match BigDecimal::from_str(token_price_per_avail.to_string().as_str()) {
                Ok(amount) => amount,
                Err(e) => {
                    error!("Failed to parse amount to BigDecimal: {}", e);
                    return BigDecimal::from(0);
                }
            };

        let price = token_price_per_avail_bigdecimal
            * amount
            * BigDecimal::from(10_u64.pow(decimals_avail as u32))
            / BigDecimal::from(10_u64.pow(decimals_token as u32));

        price.round(0)
    }

    pub fn one_avail(&self) -> BigDecimal {
        BigDecimal::from(10u64.pow(TOKEN_MAP.get("avail").unwrap().token_decimals as u32))
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Price {
    pub btc: Option<f64>,
    pub btc_market_cap: Option<f64>,
    pub eth: Option<f64>,
    pub usd: Option<f64>,
}

pub async fn update_token_prices(
    coin_gecho_api_url: String,
    coin_gecho_api_key: String,
    tokens: &Vec<String>,
    store: &CoinGeckoStore,
) {
    let client = Client::new();

    for token in tokens {
        info!("Updating token price for: {}", token);

        let (coin_price, avail_price) =
            match get_prices(&client, &coin_gecho_api_url, &coin_gecho_api_key, token).await {
                Ok(prices) => prices,
                Err(e) => {
                    error!("Failed to get prices for {}: {}", token, e);
                    continue;
                }
            };

        info!("New Token price: {}", coin_price);
        info!("New Avail price: {}", avail_price);
        store.update_token_price(token, coin_price);
        store.update_avail_price(avail_price);
    }
}

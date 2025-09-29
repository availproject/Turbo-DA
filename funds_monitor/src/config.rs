use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, env, error::Error, fs};
use toml;
use turbo_da_core::logger::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Network {
    pub contract_address: String,
    pub url: String,
    pub ws_url: String,
    pub chain_id: i32,
    pub finalised_threshold: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub(crate) network: HashMap<String, Network>,
    pub(crate) database_url: String,
    pub(crate) coin_gecho_api_url: String,
    pub(crate) coin_gecho_api_key: String,
    pub(crate) avail_rpc_url: String,
    pub(crate) avail_deposit_address: String,
}

impl Default for Config {
    fn default() -> Self {
        let mut network = HashMap::new();

        // Add a default network example (optional)
        network.insert(
            "ethereum".to_string(),
            Network {
                contract_address: String::new(),
                url: String::new(),
                ws_url: String::new(),
                chain_id: 1,
                finalised_threshold: 16,
            },
        );
        Self {
            network,
            database_url: String::new(),
            coin_gecho_api_url: String::new(),
            coin_gecho_api_key: String::new(),
            avail_rpc_url: String::new(),
            avail_deposit_address: String::new(),
        }
    }
}

impl Config {
    pub fn load_config(&self) -> Result<Config, String> {
        dotenv().ok();
        if let Ok(config) = self.load_from_toml() {
            return Ok(config);
        }

        info(&format!("Trying to read from environment variables"));
        self.load_from_env().map_err(|env_error| {
            error(&format!(
                "Failed to load configuration from environment variables: {:?}",
                env_error
            ));
            env_error.to_string()
        })
    }

    fn load_from_toml(&self) -> Result<Config, Box<dyn Error>> {
        let current_dir = env::current_dir().unwrap();
        let mut config_path = current_dir;
        config_path.push("config.toml");

        let config_str = fs::read_to_string(&config_path).map_err(|e| {
            warn(&format!("Failed to read file: {:?}", e));
            e.to_string()
        })?;

        let config = toml::from_str::<Config>(&config_str);
        match config {
            Ok(conf) => Ok(conf),
            Err(e) => {
                error(&format!("Couldn't parse TOML file: {:?}", e));
                Err(e.into())
            }
        }
    }

    fn load_from_env(&self) -> Result<Config, Box<dyn Error>> {
        let database_url = env::var("DATABASE_URL").map_err(|e| {
            error(&format!(
                "Failed to get DATABASE_URL environment variable: {:?}",
                e
            ));
            e
        })?;

        let avail_rpc_url = env::var("AVAIL_RPC_URL").map_err(|e| {
            error(&format!(
                "Failed to get AVAIL_RPC_URL environment variable: {:?}",
                e
            ));
            e
        })?;

        let coin_gecho_api_url = env::var("COINGECKO_API_URL").map_err(|e| {
            error(&format!(
                "Failed to get COINGECKO_API_URL environment variable: {:?}",
                e
            ));
            e
        })?;

        let coin_gecho_api_key = env::var("COINGECKO_API_KEY").map_err(|e| {
            error(&format!(
                "Failed to get COINGECKO_API_KEY environment variable: {:?}",
                e
            ));
            e
        })?;

        let avail_deposit_address = env::var("AVAIL_DEPOSIT_ADDRESS").map_err(|e| {
            error(&format!(
                "Failed to get AVAIL_DEPOSIT_ADDRESS environment variable: {:?}",
                e
            ));
            e
        })?;

        let mut network = HashMap::new();

        // Collect all environment variables
        let env_vars: Vec<(String, String)> = env::vars().collect();

        // Filter for network-specific variables
        let mut temp_networks: HashMap<String, HashMap<String, String>> = HashMap::new();

        for (key, value) in env_vars {
            if key.starts_with("NETWORK_") {
                if let Some((network_name, field)) = key
                    .strip_prefix("NETWORK_")
                    .and_then(|suffix| suffix.split_once('_'))
                {
                    temp_networks
                        .entry(network_name.to_lowercase())
                        .or_default()
                        .insert(field.to_lowercase(), value);
                }
            }
        }

        // Build `network` map dynamically
        for (name, fields) in temp_networks {
            let contract_address = fields.get("contract_address").cloned().unwrap_or_default();
            let url = fields.get("url").cloned().unwrap_or_default();
            let ws_url = fields.get("ws_url").cloned().unwrap_or_default();
            let finalised_threshold = fields
                .get("finalised_threshold")
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or_default();
            let chain_id = fields
                .get("chain_id")
                .and_then(|s| s.parse::<i32>().ok())
                .unwrap_or_default();

            network.insert(
                name,
                Network {
                    contract_address,
                    url,
                    ws_url,
                    chain_id,
                    finalised_threshold,
                },
            );
        }

        Ok(Config {
            network,
            database_url,
            coin_gecho_api_url,
            coin_gecho_api_key,
            avail_rpc_url,
            avail_deposit_address,
        })
    }
}

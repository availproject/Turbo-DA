/// Configuration setup
/// Checks presence of `config.toml`
/// Else checks environment variables to populate Application Configurations
use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use std::{env, error::Error, fs, io};
use toml;
use turbo_da_core::logger::{error, info, warn};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub private_keys: Vec<String>,
    pub retry_count: i32,
    pub avail_rpc_endpoint: Vec<String>,
    pub coingecko_api_url: String,
    pub coingecko_api_key: String,
    pub limit: i64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            database_url: String::new(),
            private_keys: Vec::new(),
            retry_count: 0,
            avail_rpc_endpoint: vec![],
            coingecko_api_url: String::new(),
            coingecko_api_key: String::new(),
            limit: 10,
        }
    }
}

impl AppConfig {
    pub fn load_config(&self) -> Result<AppConfig, std::io::Error> {
        dotenv().ok();
        if let Ok(config) = self.load_from_toml() {
            return Ok(config);
        }

        info(&format!("Trying to read from environment variables"));

        match self.load_from_env() {
            Ok(config) => Ok(config),
            Err(env_error) => {
                error(&format!(
                    "Couldn't load configuration: TOML error, and ENVIRONMENT error: {:?}",
                    env_error
                ));
                Err(io::Error::new(
                    io::ErrorKind::Other,
                    "Couldn't fetch configuration from either TOML file or environment variables",
                ))
            }
        }
    }
    fn load_from_toml(&self) -> Result<AppConfig, Box<dyn Error>> {
        let current_dir = env::current_dir().unwrap();

        let mut config_path = current_dir;
        config_path.push("config.toml");

        let config_str = fs::read_to_string(&config_path).map_err(|e| {
            warn(&format!("Failed to read file: {:?}", e));
            e.to_string()
        })?;

        let config = toml::from_str::<AppConfig>(&config_str);

        match config {
            Ok(conf) => Ok(conf),
            Err(e) => {
                warn(&format!("Coudln't read from TOML File"));
                Err(e.into())
            }
        }
    }

    fn load_from_env(&self) -> Result<AppConfig, Box<dyn Error>> {
        let database_url = env::var("DATABASE_URL")?;
        let mut avail_rpc_endpoint = Vec::new();
        let mut index = 1;

        while let Ok(endpoint) = env::var(format!("AVAIL_RPC_ENDPOINT_{}", index)) {
            avail_rpc_endpoint.push(endpoint);
            index += 1;
        }
        let retry_count = env::var("RETRY_COUNT")?;
        let coingecko_api_url = env::var("COINGECKO_API_URL")?;
        let coingecko_api_key = env::var("COINGECKO_API_KEY")?;
        let limit = env::var("LIMIT")?.parse::<i64>()?;
        let mut private_keys = Vec::new();
        let mut index = 0;
        while let Ok(key) = env::var(format!("PRIVATE_KEY_{}", index)) {
            private_keys.push(key);
            index += 1;
        }

        info(&format!("Config loaded from environment variables"));

        Ok(AppConfig {
            database_url,
            private_keys,
            retry_count: retry_count.parse::<i32>().unwrap(),
            avail_rpc_endpoint,
            coingecko_api_url,
            coingecko_api_key,
            limit,
        })
    }
}

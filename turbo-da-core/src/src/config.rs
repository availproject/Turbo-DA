/// Configuration setup
/// Checks presence of `config.toml`
/// Else checks environment variables to populate Application Configurations
use dotenv::dotenv;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::{env, error::Error, fs, io};
use toml;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub private_key: String,
    pub avail_rpc_endpoint: Vec<String>,
    pub coingecko_api_url: String,
    pub coingecko_api_key: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            database_url: String::new(),
            private_key: String::new(),
            avail_rpc_endpoint: vec![],
            coingecko_api_url: String::new(),
            coingecko_api_key: String::new(),
        }
    }
}

impl AppConfig {
    pub fn load_config(&self) -> Result<AppConfig, std::io::Error> {
        dotenv().ok();
        env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
        if let Ok(config) = self.load_from_toml() {
            return Ok(config);
        }

        info!("Trying to read from environment variables");

        match self.load_from_env() {
            Ok(config) => Ok(config),
            Err(env_error) => {
                error!(
                    "Couldn't load configuration: TOML error, and ENVIRONMENT error: {:?}",
                    env_error
                );
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
            warn!("Failed to read file: {:?}", e);
            e.to_string()
        })?;

        let config = toml::from_str::<AppConfig>(&config_str);

        match config {
            Ok(conf) => Ok(conf),
            Err(e) => {
                warn!("Coudln't read from TOML File");
                Err(e.into())
            }
        }
    }

    fn load_from_env(&self) -> Result<AppConfig, Box<dyn Error>> {
        let database_url = env::var("DATABASE_URL")?;
        let private_key = env::var("PRIVATE_KEY")?;
        let mut avail_rpc_endpoint = Vec::new();
        let mut index = 1;
        while let Ok(endpoint) = env::var(format!("AVAIL_RPC_ENDPOINT_{}", index)) {
            avail_rpc_endpoint.push(endpoint);
            index += 1;
        }
        let coingecko_api_url = env::var("COINGECKO_API_URL")?;
        let coingecko_api_key = env::var("COINGECKO_API_KEY")?;
        Ok(AppConfig {
            database_url,
            private_key,
            avail_rpc_endpoint,
            coingecko_api_url,
            coingecko_api_key,
        })
    }
}

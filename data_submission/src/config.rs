/// Configuration setup
/// Checks presence of `config.toml`
/// Else checks environment variables to populate Application Configurations
use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use std::{env, error::Error, fs, io, vec::Vec};
use toml;
use turbo_da_core::logger::{error, info, warn};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub port: u16,
    pub database_url: String,
    pub redis_url: String,
    pub number_of_threads: i32,
    pub max_pool_size: usize,
    pub avail_rpc_endpoint: Vec<String>,
    pub private_keys: Vec<String>,
    pub broadcast_channel_size: usize,
    pub payload_size: usize,
    pub maximum_pending_requests: i64,
    pub rate_limit_window_size: u64,
    pub rate_limit_max_requests: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            port: 8080,
            database_url: String::new(),
            redis_url: String::new(),
            number_of_threads: 3,
            max_pool_size: 10,
            avail_rpc_endpoint: vec![],
            broadcast_channel_size: 100000,
            private_keys: vec![],
            payload_size: 1024 * 1024, // in bytes
            maximum_pending_requests: 50,
            rate_limit_window_size: 60,
            rate_limit_max_requests: 100,
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
        let port = env::var("PORT")
            .map_err(|e| {
                error(&format!("Failed to get PORT environment variable: {:?}", e));
                e
            })?
            .parse::<u16>()
            .map_err(|e| {
                error(&format!("Invalid PORT value. Error: {:?}", e));
                e.to_string()
            })?;
        let database_url = env::var("DATABASE_URL")?;
        let redis_url = env::var("REDIS_URL")?;
        let number_of_threads = env::var("NUMBER_OF_THREADS")
            .map_err(|e| {
                error(&format!(
                    "Failed to get NUMBER_OF_THREADS environment variable: {:?}",
                    e
                ));
                e
            })?
            .parse::<i32>()
            .map_err(|e| {
                error(&format!("Invalid NUMBER_OF_THREADS value. Error: {:?}", e));
                e.to_string()
            })?;

        let max_pool_size = env::var("MAX_POOL_SIZE")
            .map_err(|e| {
                error(&format!(
                    "Failed to get MAX_POOL_SIZE environment variable: {:?}",
                    e
                ));
                e
            })?
            .parse::<usize>()
            .map_err(|e| {
                error(&format!("Invalid MAX_POOL_SIZE value. Error: {:?}", e));
                e.to_string()
            })?;

        let broadcast_channel_size = env::var("BROADCAST_CHANNEL_SIZE")
            .map_err(|e| {
                error(&format!(
                    "Failed to get BROADCAST_CHANNEL_SIZE environment variable: {:?}",
                    e
                ));
                e
            })?
            .parse::<usize>()
            .map_err(|e| {
                error(&format!(
                    "Invalid BROADCAST_CHANNEL_SIZE value. Error: {:?}",
                    e
                ));
                e.to_string()
            })?;

        let payload_size = env::var("PAYLOAD_SIZE")
            .map_err(|e| {
                error(&format!(
                    "Failed to get PAYLOAD_SIZE environment variable: {:?}",
                    e
                ));
                e
            })?
            .parse::<usize>()
            .map_err(|e| {
                error(&format!("Invalid PAYLOAD_SIZE value. Error: {:?}", e));
                e.to_string()
            })?;

        let maximum_pending_requests = env::var("MAXIMUM_PENDING_REQUESTS")
            .map_err(|e| {
                error(&format!(
                    "Failed to get MAXIMUM_PENDING_REQUESTS environment variable: {:?}",
                    e
                ));
                e
            })?
            .parse::<i64>()
            .map_err(|e| {
                error(&format!(
                    "Invalid MAXIMUM_PENDING_REQUESTS value. Error: {:?}",
                    e
                ));
                e.to_string()
            })?;

        let rate_limit_window_size = env::var("RATE_LIMIT_WINDOW_SIZE")
            .map_err(|e| {
                error(&format!(
                    "Failed to get RATE_LIMIT_WINDOW_SIZE environment variable: {:?}",
                    e
                ));
                e
            })?
            .parse::<u64>()
            .map_err(|e| {
                error(&format!(
                    "Invalid RATE_LIMIT_WINDOW_SIZE value. Error: {:?}",
                    e
                ));
                e.to_string()
            })?;

        let rate_limit_max_requests = env::var("RATE_LIMIT_MAX_REQUESTS")
            .map_err(|e| {
                error(&format!(
                    "Failed to get RATE_LIMIT_MAX_REQUESTS environment variable: {:?}",
                    e
                ));
                e
            })?
            .parse::<u64>()
            .map_err(|e| {
                error(&format!(
                    "Invalid RATE_LIMIT_MAX_REQUESTS value. Error: {:?}",
                    e
                ));
                e.to_string()
            })?;

        let mut avail_rpc_endpoint = Vec::new();
        let mut index = 1;
        while let Ok(endpoint) = env::var(format!("AVAIL_RPC_ENDPOINT_{}", index)) {
            avail_rpc_endpoint.push(endpoint);
            index += 1;
        }

        let mut private_keys = Vec::new();
        let mut index = 0;
        while let Ok(key) = env::var(format!("PRIVATE_KEY_{}", index)) {
            private_keys.push(key);
            index += 1;
        }

        Ok(AppConfig {
            port,
            database_url,
            redis_url,
            number_of_threads,
            max_pool_size,
            avail_rpc_endpoint,
            private_keys,
            broadcast_channel_size,
            payload_size,
            maximum_pending_requests,
            rate_limit_window_size,
            rate_limit_max_requests,
        })
    }
}

use crate::logger::{error, info, warn};
/// Configuration setup
/// Checks presence of `config.toml`
/// Else checks environment variables to populate Application Configurations
use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use std::{env, error::Error, fs, io, vec::Vec};
use toml;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub port: u16,
    pub redis_url: String,
    pub max_pool_size: usize,
    pub avail_rpc_endpoint: Vec<String>,
    pub coingecko_api_url: String,
    pub coingecko_api_key: String,
    pub total_users_query_limit: i64,
    pub rate_limit_window_size: u64,
    pub rate_limit_max_requests: u64,
    pub clerk_secret_key: String,
    pub aws_access_key_id: String,
    pub aws_endpoint_url: String,
    pub aws_region: String,
    pub s3_bucket_name: String,
    pub aws_secret_access_key: String,
    pub sumsub_app_token: String,
    pub sumsub_secret_key: String,
    pub sumsub_base_url: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            port: 8000,
            database_url: String::new(),
            redis_url: String::new(),
            max_pool_size: 10,
            coingecko_api_url: String::new(),
            coingecko_api_key: String::new(),
            total_users_query_limit: 100,
            rate_limit_window_size: 60,
            rate_limit_max_requests: 100,
            avail_rpc_endpoint: vec![],
            clerk_secret_key: String::new(),
            aws_access_key_id: String::new(),
            aws_endpoint_url: String::new(),
            aws_region: String::new(),
            s3_bucket_name: String::new(),
            aws_secret_access_key: String::new(),
            sumsub_app_token: String::new(),
            sumsub_secret_key: String::new(),
            sumsub_base_url: String::new(),
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

        info(&"Trying to read from environment variables".to_string());

        match self.load_from_env() {
            Ok(config) => Ok(config),
            Err(env_error) => {
                Err(io::Error::new(
                    io::ErrorKind::Other,
                    format!(
                        "Couldn't fetch configuration from either TOML file or environment variables {:?}   ",
                        env_error.to_string()
                    )
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
                warn(&format!("Coudln't read from TOML File: {:?}", e));
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

        let clerk_secret_key = env::var("CLERK_SECRET_KEY")?;
        let total_users_query_limit = env::var("TOTAL_USERS_QUERY_LIMIT")
            .map_err(|e| {
                error(&format!(
                    "Failed to get TOTAL_USERS_QUERY_LIMIT environment variable: {:?}",
                    e
                ));
                e
            })?
            .parse::<i64>()
            .map_err(|e| {
                error(&format!(
                    "Invalid TOTAL_USERS_QUERY_LIMIT value. Error: {:?}",
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

        let sumsub_app_token = env::var("SUMSUB_APP_TOKEN")?;
        let sumsub_secret_key = env::var("SUMSUB_SECRET_KEY")?;
        let sumsub_base_url = env::var("SUMSUB_BASE_URL")?;

        let mut avail_rpc_endpoint = Vec::new();
        let mut index = 1;
        while let Ok(endpoint) = env::var(format!("AVAIL_RPC_ENDPOINT_{}", index)) {
            avail_rpc_endpoint.push(endpoint);
            index += 1;
        }

        let coingecko_api_url = env::var("COINGECKO_API_URL")?;
        let coingecko_api_key = env::var("COINGECKO_API_KEY")?;

        let aws_access_key_id = env::var("AWS_ACCESS_KEY_ID")?;
        let aws_endpoint_url = env::var("AWS_ENDPOINT_URL")?;
        let aws_region = env::var("AWS_REGION")?;
        let s3_bucket_name = env::var("S3_BUCKET_NAME")?;
        let aws_secret_access_key = env::var("AWS_SECRET_ACCESS_KEY")?;

        Ok(AppConfig {
            port,
            database_url,
            redis_url,
            max_pool_size,
            clerk_secret_key,
            coingecko_api_url,
            coingecko_api_key,
            total_users_query_limit,
            rate_limit_window_size,
            rate_limit_max_requests,
            avail_rpc_endpoint,
            aws_access_key_id,
            aws_endpoint_url,
            aws_region,
            s3_bucket_name,
            aws_secret_access_key,
            sumsub_app_token,
            sumsub_secret_key,
            sumsub_base_url,
        })
    }
}

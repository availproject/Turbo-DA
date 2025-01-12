// This file is part of Avail Gas Relay Service.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/// Configuration setup
/// Checks presence of `config.toml`
/// Else checks environment variables to populate Application Configurations
use dotenv::dotenv;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::{env, error::Error, fs, io, vec::Vec};
use toml;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub number_of_threads: i32,
    pub max_pool_size: usize,
    pub avail_rpc_endpoint: Vec<String>,
    pub private_keys: Vec<String>,
    pub signing_key: String,
    pub coingecko_api_url: String,
    pub coingecko_api_key: String,
    pub broadcast_channel_size: usize,
    pub payload_size: usize,
    pub assigned_wallet: String,
    pub total_users_query_limit: i64,
    pub maximum_pending_requests: i64,
    pub rate_limit_window_size: u64,
    pub rate_limit_max_requests: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            database_url: String::new(),
            number_of_threads: 3,
            max_pool_size: 10,
            avail_rpc_endpoint: vec![],
            private_keys: vec![],
            signing_key: String::new(),
            #[cfg(feature = "cron")]
            failure_private_key: String::new(),
            coingecko_api_url: String::new(),
            coingecko_api_key: String::new(),
            broadcast_channel_size: 100000,
            payload_size: 1024 * 1024, // in bytes
            assigned_wallet: String::new(),
            total_users_query_limit: 100,
            maximum_pending_requests: 50,
            rate_limit_window_size: 60,
            rate_limit_max_requests: 100,
        }
    }
}

impl AppConfig {
    pub fn load_config(&self) -> Result<AppConfig, std::io::Error> {
        dotenv().ok();
        env_logger::init_from_env(env_logger::Env::new().default_filter_or("debug"));
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

        let number_of_threads = env::var("NUMBER_OF_THREADS")
            .map_err(|e| {
                error!(
                    "Failed to get NUMBER_OF_THREADS environment variable: {:?}",
                    e
                );
                e
            })?
            .parse::<i32>()
            .map_err(|e| {
                error!("Invalid NUMBER_OF_THREADS value. Error: {:?}", e);
                e.to_string()
            })?;

        let max_pool_size = env::var("MAX_POOL_SIZE")
            .map_err(|e| {
                error!("Failed to get MAX_POOL_SIZE environment variable: {:?}", e);
                e
            })?
            .parse::<usize>()
            .map_err(|e| {
                error!("Invalid MAX_POOL_SIZE value. Error: {:?}", e);
                e.to_string()
            })?;

        let broadcast_channel_size = env::var("BROADCAST_CHANNEL_SIZE")
            .map_err(|e| {
                error!(
                    "Failed to get BROADCAST_CHANNEL_SIZE environment variable: {:?}",
                    e
                );
                e
            })?
            .parse::<usize>()
            .map_err(|e| {
                error!("Invalid BROADCAST_CHANNEL_SIZE value. Error: {:?}", e);
                e.to_string()
            })?;

        let payload_size = env::var("PAYLOAD_SIZE")
            .map_err(|e| {
                error!("Failed to get PAYLOAD_SIZE environment variable: {:?}", e);
                e
            })?
            .parse::<usize>()
            .map_err(|e| {
                error!("Invalid PAYLOAD_SIZE value. Error: {:?}", e);
                e.to_string()
            })?;

        let total_users_query_limit = env::var("TOTAL_USERS_QUERY_LIMIT")
            .map_err(|e| {
                error!(
                    "Failed to get TOTAL_USERS_QUERY_LIMIT environment variable: {:?}",
                    e
                );
                e
            })?
            .parse::<i64>()
            .map_err(|e| {
                error!("Invalid TOTAL_USERS_QUERY_LIMIT value. Error: {:?}", e);
                e.to_string()
            })?;

        let maximum_pending_requests = env::var("MAXIMUM_PENDING_REQUESTS")
            .map_err(|e| {
                error!(
                    "Failed to get MAXIMUM_PENDING_REQUESTS environment variable: {:?}",
                    e
                );
                e
            })?
            .parse::<i64>()
            .map_err(|e| {
                error!("Invalid MAXIMUM_PENDING_REQUESTS value. Error: {:?}", e);
                e.to_string()
            })?;

        let rate_limit_window_size = env::var("RATE_LIMIT_WINDOW_SIZE")
            .map_err(|e| {
                error!(
                    "Failed to get RATE_LIMIT_WINDOW_SIZE environment variable: {:?}",
                    e
                );
                e
            })?
            .parse::<u64>()
            .map_err(|e| {
                error!("Invalid RATE_LIMIT_WINDOW_SIZE value. Error: {:?}", e);
                e.to_string()
            })?;

        let rate_limit_max_requests = env::var("RATE_LIMIT_MAX_REQUESTS")
            .map_err(|e| {
                error!(
                    "Failed to get RATE_LIMIT_MAX_REQUESTS environment variable: {:?}",
                    e
                );
                e
            })?
            .parse::<u64>()
            .map_err(|e| {
                error!("Invalid RATE_LIMIT_MAX_REQUESTS value. Error: {:?}", e);
                e.to_string()
            })?;

        let mut avail_rpc_endpoint = Vec::new();
        let mut index = 1;
        while let Ok(endpoint) = env::var(format!("AVAIL_RPC_ENDPOINT_{}", index)) {
            avail_rpc_endpoint.push(endpoint);
            index += 1;
        }

        let signing_key = env::var("SIGNING_KEY")?;

        let mut private_keys = Vec::new();
        let mut index = 0;
        while let Ok(key) = env::var(format!("PRIVATE_KEY_{}", index)) {
            private_keys.push(key);
            index += 1;
        }

        let wallet_assigned = env::var("ASSIGNED_WALLET")?;

        let coingecko_api_url = env::var("COINGECKO_API_URL")?;
        let coingecko_api_key = env::var("COINGECKO_API_KEY")?;

        Ok(AppConfig {
            database_url,
            number_of_threads,
            max_pool_size,
            avail_rpc_endpoint,
            private_keys,
            signing_key,
            coingecko_api_url,
            coingecko_api_key,
            broadcast_channel_size,
            payload_size,
            assigned_wallet: wallet_assigned,
            total_users_query_limit,
            maximum_pending_requests,
            rate_limit_window_size,
            rate_limit_max_requests,
        })
    }
}

use avail_rust::Client;
use chrono::Utc;
use config::AppConfig;
use cron::Schedule;
use enigma::EnigmaEncryptionService;
use monitor::monitor::monitor_failed_transactions;
use observability::{init_meter, init_tracer};
use std::str::FromStr;
use std::sync::Arc;
use tokio::{
    self,
    time::{self, sleep, Duration},
};
use turbo_da_core::{
    logger::{error, info},
    utils::generate_keygen_list,
};

mod config;
mod monitor;

const WAIT_TIME: u64 = 5;

/// Main entry point for the fallback monitor service
///
/// # Description
/// Initializes the service by:
/// 1. Loading configuration
/// 2. Setting up a cron schedule to run every 10 seconds
/// 3. Establishing database connection
/// 4. Creating an Avail SDK instance
/// 5. Running an infinite loop to monitor failed transactions
///
/// The service will continuously check for failed transactions at the scheduled intervals
/// and attempt to process them using the Avail network.
#[tokio::main]
async fn main() {
    let app_config: AppConfig = match AppConfig::default().load_config() {
        Ok(conf) => conf,
        Err(e) => {
            error(&format!("Couldn't load the config. Error: {:?}", e));
            return;
        }
    };
    init_meter("fallback_service");
    init_tracer("fallback_service");
    let expression = "0/10 * * * * * *"; // Every 10 seconds
    let schedule = Schedule::from_str(expression).unwrap();

    info(&format!("Cron is starting..."));

    let mut interval = schedule.upcoming(Utc);

    let keypair = generate_keygen_list(app_config.limit as i32, &app_config.private_keys).await;

    while let Some(next_time) = interval.next() {
        let now = Utc::now();
        let duration = next_time - now;

        if duration.num_seconds() > 0 {
            time::sleep(Duration::from_secs(duration.num_seconds() as u64)).await
        }

        info(&format!(
            "Checking Failed Transactions at {} .....",
            Utc::now()
        ));

        let sdk = generate_avail_sdk(&Arc::new(app_config.avail_rpc_endpoint.clone())).await;

        let enigma = EnigmaEncryptionService::new(app_config.enigma_url.clone());

        monitor_failed_transactions(
            &app_config.database_url,
            &sdk,
            &keypair,
            app_config.retry_count,
            app_config.limit,
            &enigma,
        )
        .await;
    }
}

/// Attempts to establish a connection to an Avail network endpoint
///
/// # Arguments
/// * `endpoints` - A vector of Avail RPC endpoint URLs to try connecting to
///
/// # Returns
/// Returns an SDK instance connected to a working endpoint
///
/// # Description
/// This function implements a retry mechanism that:
/// 1. Tries each endpoint in the provided list
/// 2. If all endpoints fail, waits for WAIT_TIME seconds before retrying
/// 3. Continues until a successful connection is established
///
/// The function cycles through the endpoints indefinitely until a connection succeeds.
async fn generate_avail_sdk(endpoints: &Arc<Vec<String>>) -> Client {
    let mut attempts = 0;

    loop {
        if attempts < endpoints.len() {
            attempts = 0;
        }
        let endpoint = &endpoints[attempts];
        info(&format!("Attempting to connect endpoint: {:?}", endpoint));
        match Client::new(endpoint).await {
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

use avail_rust::SDK;
use chrono::Utc;
use config::AppConfig;
use cron::Schedule;
use diesel_async::{AsyncConnection, AsyncPgConnection};
use log::{error, info};
use monitor::monitor::monitor_failed_transactions;
use std::str::FromStr;
use std::sync::Arc;
use tokio::{
    self,
    time::{self, sleep, Duration},
};
use turbo_da_core::utils::create_keypair;

mod config;
mod db;
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
            error!("Couldn't load the config. Error: {:?}", e);
            return;
        }
    };

    let expression = "0/10 * * * * * *"; // Every 10 seconds
    let schedule = Schedule::from_str(expression).unwrap();

    info!("Cron is starting...");

    let mut interval = schedule.upcoming(Utc);

    let keypair = create_keypair(&app_config.private_key);

    while let Some(next_time) = interval.next() {
        let now = Utc::now();
        let duration = next_time - now;

        if duration.num_seconds() > 0 {
            time::sleep(Duration::from_secs(duration.num_seconds() as u64)).await
        }

        info!("Checking Failed Transactions at {} .....", Utc::now());

        let sdk = generate_avail_sdk(&Arc::new(app_config.avail_rpc_endpoint.clone())).await;
        let mut connection = AsyncPgConnection::establish(&app_config.database_url)
            .await
            .expect("Failed to connect to db");
        monitor_failed_transactions(&mut connection, &sdk, &keypair, app_config.retry_count).await;
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
async fn generate_avail_sdk(endpoints: &Arc<Vec<String>>) -> SDK {
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

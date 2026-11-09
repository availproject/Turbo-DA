use chrono::Utc;
use config::AppConfig;
use cron::Schedule;
use data_submission::redis::Redis;
use enigma::EnigmaEncryptionService;
use monitor::monitor::{monitor_failed_transactions, Networks};
use observability::{init_meter, init_tracer};
use std::str::FromStr;
use std::sync::Arc;
use tokio::{
    self,
    time::{self, Duration},
};
use turbo_da_core::utils::{generate_keygen_list, generate_normal_keygen_list};

mod config;
mod monitor;

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
    dotenv::dotenv().ok();
    let _guard = init_tracer("fallback_service");
    init_meter("fallback_service");

    let app_config: AppConfig = match AppConfig::default().load_config() {
        Ok(conf) => conf,
        Err(e) => {
            tracing::error!(error = ?e, "couldn't load the config");
            return;
        }
    };
    let expression = "0/10 * * * * * *"; // Every 10 seconds
    let schedule = Schedule::from_str(expression).unwrap();

    tracing::info!("cron is starting...");

    let mut interval = schedule.upcoming(Utc);

    let networks = Networks {
        normal_endpoints: Arc::new(app_config.avail_rpc_endpoint.clone()),
        infinity_endpoints: Arc::new(app_config.avail_infinity_rpc_endpoint.clone()),
        normal_keypairs: generate_normal_keygen_list(
            app_config.limit as i32,
            &app_config.private_keys,
        ),
        infinity_keypairs: generate_keygen_list(
            app_config.limit as i32,
            &app_config.private_keys,
        )
        .await,
    };

    while let Some(next_time) = interval.next() {
        let now = Utc::now();
        let duration = next_time - now;

        if duration.num_seconds() > 0 {
            time::sleep(Duration::from_secs(duration.num_seconds() as u64)).await
        }

        tracing::info!(time = %Utc::now(), "checking failed transactions");

        let enigma = EnigmaEncryptionService::new(app_config.enigma_url.clone());

        let redis = Arc::new(Redis::new(app_config.redis_url.as_str()));

        monitor_failed_transactions(
            &app_config.database_url,
            &networks,
            redis,
            app_config.retry_count,
            app_config.limit,
            &enigma,
        )
        .await;
    }
}

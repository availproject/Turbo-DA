mod avail;
mod config;
mod evm;
mod utils;
use std::sync::Arc;

use avail::run;
use config::Config;
use config::Network;
use db::{models::indexer::IndexerBlockNumbers, schema::indexer_block_numbers::dsl::*};
use diesel::prelude::*;
use diesel::PgConnection;
use evm::EVM;
use log::debug;
use log::{error, info};

#[tokio::main]
async fn main() {
    let cfg = match Config::default().load_config() {
        Ok(c) => c,
        Err(e) => {
            info!("Error loading config: {}", e);
            return;
        }
    };
    println!("cfg: {:?}", cfg);
    let cfg_ref = Arc::new(cfg);
    let cfg_ref_2 = cfg_ref.clone();
    let cfg_ref_3 = cfg_ref.clone();

    tokio::spawn(async move {
        info!("Starting Avail Chain Monitor");

        let result = run(cfg_ref.clone()).await;
        if let Err(e) = result {
            error!("Error running Avail Chain Monitor: {:?}", e);
        }
    });

    for (network_name, network_config) in &cfg_ref_2.network {
        let network_name = network_name.clone();
        let network_config = network_config.clone();

        let cfg_ref_4 = cfg_ref_3.clone();
        debug!("Task for network: {}", network_name);

        tokio::spawn(async move {
            debug!("Spawning new task");

            match monitor(network_config, cfg_ref_4).await {
                Ok(_) => info!("Monitor task completed successfully"),
                Err(e) => error!("Error running monitor task: {}", e),
            }
        });
    }
}

async fn monitor(network_config: Network, cfg: Arc<Config>) -> Result<(), String> {
    let mut connection = PgConnection::establish(&cfg.database_url)
        .map_err(|e| format!("Error connecting to {}: {}", cfg.database_url, e))?;

    let finalised_block_number =
        query_finalised_block_number(network_config.chain_id, &mut connection);

    drop(connection);

    let mut evm = EVM::new(
        network_config.contract_address,
        network_config.ws_url,
        network_config.chain_id,
        network_config.finalised_threshold,
        finalised_block_number.block_number as u64,
        cfg.clone(),
    )
    .await
    .map_err(|e| format!("Error creating EVM connection: {}", e))?;

    evm.monitor_evm_chains().await;

    Ok(())
}

fn query_finalised_block_number(
    evm_chain_id: i32,
    connection: &mut PgConnection,
) -> IndexerBlockNumbers {
    let row = indexer_block_numbers
        .filter(chain_id.eq(evm_chain_id))
        .select(IndexerBlockNumbers::as_select())
        .first::<IndexerBlockNumbers>(connection);

    match row {
        Ok(row) => row,
        Err(e) => {
            error!("Failed to query finalised block number: {}", e);
            return IndexerBlockNumbers {
                id: 0,
                chain_id: 0,
                block_number: 0,
                block_hash: "".to_string(),
            };
        }
    }
}

mod avail;
mod config;
mod evm;
mod utils;
use std::sync::Arc;

use avail::run;
use config::Config;
use diesel::PgConnection;
use evm::EVM;
use log::{error, info};
use utils::Utils;
// TODO: Clean up the code
#[tokio::main]
async fn main() {
    let cfg = match Config::default().load_config() {
        Ok(c) => c,
        Err(e) => {
            info!("Error loading config: {}", e);
            return;
        }
    };
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

        let network_ws_url = network_config.ws_url.clone();
        let contract_address = network_config.contract_address.clone();
        let finalised_threshold = network_config.finalised_threshold.clone();

        let cfg_ref_4 = cfg_ref_3.clone();
        info!("Task for network: {}", network_name);

        tokio::spawn(async move {
            info!("Spawning new task");

            let mut connection =
                match PgConnection::establish(cfg_ref_4.clone().database_url.as_str().clone())
                    .map_err(|e| {
                        format!(
                            "Error connecting to {}: {}",
                            cfg_ref_4.clone().database_url.clone(),
                            e
                        )
                    }) {
                    Ok(conn) => conn,
                    Err(e) => {
                        error!("Failed to establish database connection: {}", e);
                        return;
                    }
                };

            let finalised_block_number =
                query_finalised_block_number(network_config.chain_id, &mut connection);

            drop(connection);
            let mut evm = match EVM::new(
                contract_address,
                network_ws_url,
                network_config.chain_id,
                finalised_threshold,
                finalised_block_number.block_number as u64,
                cfg_ref_4.clone(),
            )
            .await
            {
                Ok(evm) => evm,
                Err(e) => {
                    error!("Error creating EVM connection: {}", e);
                    return;
                }
            };

            evm.monitor_evm_chains().await;
        })
        .await
        .unwrap();
    }
}

use db::{models::indexer::IndexerBlockNumbers, schema::indexer_block_numbers::dsl::*};
use diesel::prelude::*;
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

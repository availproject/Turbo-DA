mod config;
mod evm;

use config::Config;
use diesel::PgConnection;
use evm::EVM;
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

    for (network_name, network_config) in &cfg.network {
        let database_url = cfg.database_url.clone();

        let network_name = network_name.clone();
        let network_config = network_config.clone();

        let network_ws_url = network_config.ws_url.clone();
        let contract_address = network_config.contract_address.clone();
        let finalised_threshold = network_config.finalised_threshold.clone();
        let coin_gecho_api_url = cfg.coin_gecho_api_url.clone();
        let coin_gecho_api_key = cfg.coin_gecho_api_key.clone();

        info!("Task for network: {}", network_name);

        tokio::spawn(async move {
            info!("Spawning new task");

            let mut connection = match PgConnection::establish(database_url.as_str())
                .map_err(|e| format!("Error connecting to {}: {}", database_url, e))
            {
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
                database_url,
                network_ws_url,
                network_config.chain_id,
                finalised_threshold,
                finalised_block_number.block_number as u64,
                coin_gecho_api_url,
                coin_gecho_api_key,
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

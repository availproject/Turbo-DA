mod avail;
mod config;
mod evm;
mod utils;

use avail::run;
use config::Config;
use config::Network;
use db::{models::indexer::IndexerBlockNumbers, schema::indexer_block_numbers::dsl::*};
use diesel::prelude::*;
use diesel::PgConnection;
use evm::EVM;
use observability::init_tracer;

use std::sync::Arc;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let _guard = init_tracer("funds_monitor");
    let cfg = match Config::default().load_config() {
        Ok(c) => c,
        Err(e) => {
            tracing::info!(error = %e, "error loading config");
            return;
        }
    };

    let cfg_ref = Arc::new(cfg);
    let cfg_ref_2 = cfg_ref.clone();
    let cfg_ref_3 = cfg_ref.clone();

    let mut handles = Vec::new();
    handles.push(tokio::spawn(async move {
        tracing::info!("starting avail chain monitor");

        let result = run(cfg_ref.clone()).await;
        if let Err(e) = result {
            tracing::error!(error = ?e, "error running avail chain monitor");
        }
    }));

    for (network_name, network_config) in &cfg_ref_2.network {
        let network_name = network_name.clone();
        let network_config = network_config.clone();

        let cfg_ref_4 = cfg_ref_3.clone();
        tracing::debug!(
            message = "task for network",
            network_name = %network_name,
            level = "debug"
        );

        handles.push(tokio::spawn(async move {
            tracing::debug!("spawning new task");

            match monitor(network_config, cfg_ref_4).await {
                Ok(_) => tracing::info!("monitor task completed successfully"),
                Err(e) => tracing::error!(error = %e, "error running monitor task"),
            }
        }));
    }

    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            tracing::info!("ctrl+c pressed, shutting down...");
        }
        _ = futures::future::join_all(handles) => {}
    }
}

async fn monitor(network_config: Network, cfg: Arc<Config>) -> Result<(), String> {
    let mut connection = PgConnection::establish(&cfg.database_url)
        .map_err(|e| format!("Error connecting to {}: {}", cfg.database_url, e))?;

    let finalised_block_number =
        query_finalised_block_number(network_config.chain_id, &mut connection);
    tracing::info!(
        finalised_block_number = finalised_block_number.block_number,
        chain_id = network_config.chain_id,
        "finalised block number"
    );
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

    evm.monitor_evm_chain().await;

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
            tracing::error!(error = %e, "failed to query finalised block number");
            return IndexerBlockNumbers {
                id: 0,
                chain_id: 0,
                block_number: 0,
                block_hash: "0x0000000000000000000000000000000000000000000000000000000000000000"
                    .to_string(),
            };
        }
    }
}

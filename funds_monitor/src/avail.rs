use std::sync::Arc;

use avail::runtime_types::da_runtime::RuntimeCall;
use avail::runtime_types::frame_system::pallet::Call::remark_with_event as RemarkWithEvent;
use avail::runtime_types::pallet_balances::pallet::Call::transfer_keep_alive as TransferKeepAlive;
use avail::utility::calls::types::BatchAll;
use avail_rust::prelude::*;
use avail_rust::{avail, block, error::ClientError, subxt, Block, Filter, SDK};
use diesel::PgConnection;
use log::{debug, error, info};
use subxt::utils::MultiAddress;

use crate::config::Config;
use crate::query_finalised_block_number;
use crate::utils::{Deposit, Utils};
// Remark is the user id in hex format
pub async fn run(cfg: Arc<Config>) -> Result<(), ClientError> {
    info!("Starting Avail Chain Monitor");
    let sdk = SDK::new(cfg.avail_rpc_url.as_str()).await?;
    let utils = Utils::new(
        cfg.coin_gecho_api_url.clone(),
        cfg.coin_gecho_api_key.clone(),
        cfg.database_url.clone(),
        cfg.avail_rpc_url.clone(),
    );

    info!("SDK initialized with local endpoint");

    let mut connection = utils.establish_connection()?;

    sync_database(&mut connection, &sdk, &utils).await?;
    println!("avail_rpc_url: {:?}", cfg.avail_rpc_url);
    let mut stream = sdk.client.blocks().subscribe_finalized().await?;
    while let Some(avail_block) = stream.next().await {
        match avail_block {
            Ok(avail_block) => {
                let block: Block = Block::from_block(avail_block).await?;
                process_block(block, &utils).await?;
            }
            Err(e) => {
                error!("Error fetching block: {}", e);
            }
        }
    }

    Ok(())
}

async fn sync_database(
    connection: &mut PgConnection,
    client: &SDK,
    utils: &Utils,
) -> Result<(), ClientError> {
    let finalised_block_number = query_finalised_block_number(0, connection);
    let block = Block::new(
        &client.client,
        new_h256_from_hex(&finalised_block_number.block_hash)?,
    )
    .await?;
    process_block(block, utils).await?;
    Ok(())
}

async fn process_block(block: Block, utils: &Utils) -> Result<(), ClientError> {
    info!("Filtering batch calls from block");

    let all_batch_calls = block.transactions_static::<BatchAll>(Filter::new());
    info!("Filtering batch calls from block");

    // Filtering
    for batch_all in all_batch_calls {
        let number = block.block.number();
        let hash = block.block.hash().to_string();
        let account = hex::encode(batch_all.account_id().unwrap().0);
        let tx_hash = batch_all.tx_hash().to_string();
        let calls = batch_all.value.calls;
        // We know that our batch calls needs to have exactly 2 transactions.
        if calls.len() != 2 {
            info!("Skipping batch with {} calls (expected 2)", calls.len());
            continue;
        }

        // Balance/Transfer Call
        let RuntimeCall::Balances(balances_call) = &calls[0] else {
            info!("First call is not a Balances call, skipping");
            continue;
        };
        let TransferKeepAlive { dest, value } = balances_call else {
            info!("Balances call is not TransferKeepAlive, skipping");
            continue;
        };

        // System/Remark call
        let RuntimeCall::System(system_call) = &calls[1] else {
            info!("Second call is not a System call, skipping");
            continue;
        };

        let RemarkWithEvent { remark } = system_call else {
            info!("System call is not RemarkWithEvent, skipping");
            continue;
        };

        let MultiAddress::Id(acc) = dest else {
            info!("Destination is not an Id address, skipping");
            continue;
        };

        let acc_string = std::format!("{}", acc);
        let ascii_remark = block::to_ascii(remark.clone()).unwrap();
        debug!(
            "Found matching batch call - Destination: {}, Value: {}, Remark: {:?}",
            acc_string, value, ascii_remark
        );

        let mut connection = utils.establish_connection()?;

        utils
            .update_finalised_block_number(number as i32, hash, &mut connection, 0)
            .await
            .map_err(|e| format!("Failed to update finalised block number: {}", e))?;

        let receipt = Deposit {
            token_address: "0x0000000000000000000000000000000000000000".to_string(),
            amount: value.to_string(),
            from: account,
        };

        utils
            .update_database_on_deposit(
                &ascii_remark,
                &receipt,
                &tx_hash,
                &mut connection,
                0,
                &"Processed".to_string(),
            )
            .await
            .map_err(|e| {
                error!("Failed to update database on deposit: {}", e);
                format!("Failed to update database on deposit: {}", e)
            })?;
    }

    Ok(())
}

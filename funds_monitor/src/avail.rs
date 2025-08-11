use avail::runtime_types::da_runtime::RuntimeCall;
use avail::runtime_types::frame_system::pallet::Call::remark as Remark;
use avail::runtime_types::pallet_balances::pallet::Call::transfer_keep_alive as TransferKeepAlive;
use avail::utility::calls::types::BatchAll;
use avail_rust::prelude::*;
use avail_rust::{avail, error::ClientError, Block, Filter, SDK};
use diesel::PgConnection;
use std::sync::Arc;
use subxt::utils::MultiAddress;
use turbo_da_core::logger::{debug, error, info};

use crate::config::Config;
use crate::query_finalised_block_number;
use crate::utils::{Deposit, Utils};
// Remark is the user id in hex format
pub async fn run(cfg: Arc<Config>) -> Result<(), ClientError> {
    debug(&format!("Starting Avail Chain Monitor"));
    let sdk = SDK::new(cfg.avail_rpc_url.as_str()).await?;
    let utils = Utils::new(
        cfg.coin_gecho_api_url.clone(),
        cfg.coin_gecho_api_key.clone(),
        cfg.database_url.clone(),
        cfg.avail_rpc_url.clone(),
    );

    debug(&format!("SDK initialized with local endpoint"));

    let mut connection = utils.establish_connection()?;

    let _ = sync_database(&mut connection, &sdk, &utils, &cfg.avail_deposit_address).await;

    let mut stream = sdk.client.blocks().subscribe_finalized().await?;
    while let Some(avail_block) = stream.next().await {
        match avail_block {
            Ok(avail_block) => {
                let block: Block = match Block::from_block(avail_block).await {
                    Ok(block) => block,
                    Err(e) => {
                        error(&format!("Error fetching block: {}", e));
                        continue;
                    }
                };
                info(&format!("block: {}", block.block.number()));
                let _ = process_block(block, &utils, &cfg.avail_deposit_address).await;
            }
            Err(e) => {
                error(&format!("Error fetching block: {}", e));
            }
        }
    }

    Ok(())
}

async fn sync_database(
    connection: &mut PgConnection,
    client: &SDK,
    utils: &Utils,
    avail_deposit_address: &String,
) -> Result<(), ClientError> {
    let finalised_block_number = query_finalised_block_number(0, connection);
    let block = Block::new(
        &client.client,
        new_h256_from_hex(&finalised_block_number.block_hash)?,
    )
    .await?;
    process_block(block, utils, avail_deposit_address).await?;
    Ok(())
}

async fn process_block(
    block: Block,
    utils: &Utils,
    avail_deposit_address: &String,
) -> Result<(), ClientError> {
    debug(&format!("Filtering batch calls from block"));

    let all_batch_calls = block.transactions_static::<BatchAll>(Filter::new());

    // Filtering
    for batch_all in all_batch_calls {
        let number = block.block.number();
        let hash = block.block.hash().to_string();
        let account = hex::encode(batch_all.account_id().unwrap().0);
        let tx_hash = hex::encode(batch_all.tx_hash().as_bytes());
        let calls = batch_all.value.calls;
        info(&format!(
            "Found matching batch call, tx_hash: {}, account: {}, number: {}, hash: {}",
            tx_hash, account, number, hash
        ));
        // We know that our batch calls needs to have exactly 2 transactions.
        if calls.len() != 2 {
            info(&format!(
                "Skipping batch with {} calls (expected 2)",
                calls.len()
            ));
            continue;
        }

        // Balance/Transfer Call
        let RuntimeCall::Balances(balances_call) = &calls[0] else {
            info(&format!("First call is not a Balances call, skipping"));
            continue;
        };
        let TransferKeepAlive { dest, value } = balances_call else {
            info(&format!("Balances call is not TransferKeepAlive, skipping"));
            continue;
        };

        // System/Remark call
        let RuntimeCall::System(system_call) = &calls[1] else {
            info(&format!("Second call is not a System call, skipping"));
            continue;
        };

        let Remark { remark } = system_call else {
            info(&format!("System call is not RemarkWithEvent, skipping"));
            continue;
        };

        let MultiAddress::Id(acc) = dest else {
            info(&format!("Destination is not an Id address, skipping"));
            continue;
        };

        if acc.to_string() != avail_deposit_address.to_string() {
            error(&format!(
                "Destination is not the deposit address, skipping: {}",
                acc.to_string()
            ));
            continue;
        }

        let ascii_remark = hex::encode(remark.clone());
        info(&format!(
            "Found matching batch call, tx_hash: {}, account: {}, number: {}, hash: {}, ascii_remark: {}",
            tx_hash, account, number, hash, ascii_remark
        ));

        let mut connection = utils.establish_connection()?;

        utils
            .update_finalised_block_number(number as i32, hash, &mut connection, 0)
            .await
            .map_err(|e| format!("Failed to update finalised block number: {}", e))?;

        let receipt = Deposit {
            token_address: "0x0000000000000000000000000000000000000000".to_string(),
            amount: value.to_string(),
            _from: account,
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
                error(&format!("Failed to update database on deposit: {}", e));
                format!("Failed to update database on deposit: {}", e)
            })?;
    }

    Ok(())
}

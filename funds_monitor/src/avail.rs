use avail_rust::avail::utility::tx::BatchAll;
use avail_rust::avail::RuntimeCall;
use avail_rust::prelude::*;
use diesel::PgConnection;
use std::sync::Arc;
use turbo_da_core::logger::{debug, error, info};

use crate::config::Config;
use crate::query_finalised_block_number;
use crate::utils::{Deposit, Utils};
// Remark is the user id in hex format
pub async fn run(cfg: Arc<Config>) -> Result<(), String> {
    debug(&format!("Starting Avail Chain Monitor"));
    let sdk = Client::new(cfg.avail_rpc_url.as_str()).await;
    let sdk = sdk.map_err(|e| e.to_string())?;
    let utils = Utils::new(
        cfg.coin_gecho_api_url.clone(),
        cfg.coin_gecho_api_key.clone(),
        cfg.database_url.clone(),
        cfg.avail_rpc_url.clone(),
    );

    debug(&format!("SDK initialized with local endpoint"));

    let mut connection = utils.establish_connection()?;

    if let Err(e) = sync_database(&mut connection, &sdk, &utils, &cfg.avail_deposit_address).await {
        error(&format!("Failed to sync database: {}", e.to_string()));
    }

    let mut sub = Sub::new(sdk.clone());
    loop {
        let b_info = sub.next().await;
        let b_info = match b_info {
            Ok(x) => x,
            Err(err) => {
                error(&std::format!("Failed to stream next block. Error: {}", err));
                continue;
            }
        };

        info(&std::format!("Fetched block height: {}", b_info.height));
        if let Err(e) = process_block(
            &sdk,
            b_info.hash,
            b_info.height,
            &utils,
            &cfg.avail_deposit_address,
        )
        .await
        {
            error(&format!("Failed to process block: {}", e.to_string()));
        }
    }
}

async fn sync_database(
    connection: &mut PgConnection,
    client: &Client,
    utils: &Utils,
    avail_deposit_address: &String,
) -> Result<(), String> {
    let finalized_info = query_finalised_block_number(0, connection);

    let block_hash = H256::from_str(&finalized_info.block_hash).map_err(|e| e.to_string())?;
    let block_height = finalized_info.block_number as u32;
    process_block(
        client,
        block_hash,
        block_height,
        utils,
        avail_deposit_address,
    )
    .await?;
    Ok(())
}

async fn process_block(
    client: &Client,
    block_hash: H256,
    block_height: u32,
    utils: &Utils,
    avail_deposit_address: &String,
) -> Result<(), String> {
    debug(&format!("Filtering batch calls from block"));

    let block = BlockWithTx::new(client.clone(), block_hash);
    let all = block.all::<BatchAll>(Default::default()).await;
    let all = all.map_err(|e| e.to_string())?;

    for tx in all {
        let tx_hash = tx.ext_hash();

        info(&format!(
            "Found Some Batch call, tx hash: {}, account: {:?}, block height: {}, block hash: {}",
            tx_hash, tx.signature.address, block_height, block_hash
        ));

        let calls = tx.call.decode_calls();
        let calls = match calls {
            Ok(x) => x,
            Err(_) => {
                info(&std::format!("Failed to decode Batch-All calls. Most likely it does not matter as this probably is not our extrinsic that we are looking for. Block Hash: {}, Tx Index: {}", block_hash, tx.ext_index()));
                continue;
            }
        };

        // We know that our batch calls needs to have exactly 2 transactions.
        if tx.call.len() != 2 {
            info(&format!(
                "Skipping batch with {} calls (expected 2)",
                calls.len()
            ));
            continue;
        }

        let MultiAddress::Id(account_id) = tx.signature.address else {
            info(&std::format!("MultiAddress is not of variant MultiAddress::Id. Most likely it does not matter as this probably is not our extrinsic that we are looking for. Block Hash: {}, Tx Index: {}", block_hash, tx.ext_index()));
            continue;
        };

        // Balance/Transfer Call
        let RuntimeCall::BalancesTransferKeepAlive(balances_call) = &calls[0] else {
            info(&format!("First call is not a Balances call, skipping"));
            continue;
        };

        // System/Remark call
        let RuntimeCall::SystemRemark(remark_call) = &calls[1] else {
            info(&format!("Second call is not a System call, skipping"));
            continue;
        };

        if account_id.to_string() != avail_deposit_address.to_string() {
            error(&format!(
                "Destination is not the deposit address, skipping: {}",
                account_id.to_string()
            ));
            continue;
        }

        let account_id_hex = hex::encode(account_id.0);
        let tx_hash_hex = hex::encode(tx_hash.0);
        let block_hash_hex = hex::encode(block_hash.0);

        let ascii_remark = hex::encode(remark_call.remark.clone());
        info(&format!(
            "Found matching batch call, tx hash: {}, (hex) account: {}, block height: {}, block hash: {:?}, ascii_remark: {}",
            tx_hash, account_id_hex, block_height, block_hash, ascii_remark
        ));

        let mut connection = utils.establish_connection()?;

        utils
            .update_finalised_block_number(block_height as i32, block_hash_hex, &mut connection, 0)
            .await
            .map_err(|e| format!("Failed to update finalised block number: {}", e))?;

        let receipt = Deposit {
            token_address: "0x0000000000000000000000000000000000000000".to_string(),
            amount: balances_call.value.to_string(),
            _from: account_id_hex,
        };

        utils
            .update_database_on_deposit(
                &ascii_remark,
                &receipt,
                &tx_hash_hex,
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

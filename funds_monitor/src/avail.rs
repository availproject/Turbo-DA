use avail_rust::avail::balances::events::Transfer;
use avail_rust::avail::utility::tx::BatchAll;
use avail_rust::avail::RuntimeCall;
use avail_rust::avail_rust_core::Preamble;
use avail_rust::prelude::*;
use diesel::PgConnection;
use std::str::FromStr;
use std::sync::Arc;

use crate::config::Config;
use crate::query_finalised_block_number;
use crate::utils::{Deposit, Utils};
// Remark is the user id in hex format
pub async fn run(cfg: Arc<Config>) -> Result<(), String> {
    tracing::debug!("starting avail chain monitor");
    let sdk = Client::connect(cfg.avail_rpc_url.as_str()).await;
    let sdk = sdk.map_err(|e| e.to_string())?;
    let utils = Utils::new(
        cfg.coin_gecho_api_url.clone(),
        cfg.coin_gecho_api_key.clone(),
        cfg.database_url.clone(),
        cfg.avail_rpc_url.clone(),
    );

    tracing::debug!("sdk initialized with local endpoint");

    let mut connection = utils.establish_connection()?;

    if let Err(e) = sync_database(&mut connection, &sdk, &utils, &cfg.avail_deposit_address).await {
        tracing::error!(error = %e, "failed to sync database");
    }

    let mut sub = sdk
        .subscribe()
        .raw()
        .build()
        .await
        .map_err(|e| e.to_string())?;
    loop {
        let b_info = sub.next().await;
        let b_info = match b_info {
            Ok(x) => x,
            Err(err) => {
                tracing::error!(error = %err, "failed to stream next block");
                continue;
            }
        };

        tracing::info!(height = b_info.block_height, "fetched block height");
        if let Err(e) = process_block(
            &sdk,
            b_info.block_hash,
            b_info.block_height,
            &utils,
            &cfg.avail_deposit_address,
        )
        .await
        {
            tracing::error!(error = %e, "failed to process block");
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
    tracing::debug!("filtering batch calls from block");

    let block = client.block(block_hash).extrinsics();
    let all = block.all_as::<BatchAll>(Default::default()).await;
    let all = all.map_err(|e| e.to_string())?;

    let block_hash_hex = hex::encode(block_hash.0);
    let mut connection = utils.establish_connection()?;

    for tx in all {
        let tx_hash = tx.ext_hash();

        let Preamble::Signed(address, _, _) = &tx.preamble else {
            continue;
        };

        tracing::info!(
            tx_hash = %tx_hash,
            account = ?address,
            block_height = block_height,
            block_hash = %block_hash,
            "found some batch call"
        );

        let calls = tx.call.decode_calls();
        let calls = match calls {
            Ok(x) => x,
            Err(_) => {
                tracing::info!(
                    block_hash = %block_hash,
                    tx_index = tx.ext_index(),
                    "failed to decode batch-all calls, skipping"
                );
                continue;
            }
        };

        // We know that our batch calls needs to have exactly 2 transactions.
        if tx.call.len() != 2 {
            tracing::info!(
                call_count = calls.len(),
                "skipping batch with unexpected number of calls (expected 2)"
            );
            continue;
        }

        let MultiAddress::Id(account_id) = address else {
            tracing::info!(
                block_hash = %block_hash,
                tx_index = tx.ext_index(),
                "multiaddress is not of variant multiaddress::id, skipping"
            );
            continue;
        };

        // Balance/Transfer Call
        let RuntimeCall::BalancesTransferKeepAlive(balances_call) = &calls[0] else {
            tracing::info!("first call is not a balances call, skipping");
            continue;
        };

        // System/Remark call
        let RuntimeCall::SystemRemark(remark_call) = &calls[1] else {
            tracing::info!("second call is not a system call, skipping");
            continue;
        };
        let MultiAddress::Id(dest) = &balances_call.dest else {
            tracing::error!(
                destination = %account_id,
                "destination is not a valid account id, skipping"
            );
            continue;
        };

        if dest.to_string() != avail_deposit_address.to_string() {
            tracing::error!(
                destination = %account_id,
                "destination is not the deposit address, skipping"
            );
            continue;
        }
        let account_id_hex = hex::encode(account_id.0);
        let tx_hash_hex = hex::encode(tx_hash.0);

        let events = match tx.events(client.clone()).await {
            Ok(events) => events,
            Err(e) => {
                tracing::error!(error = %e, tx_hash = %tx_hash_hex, "failed to fetch extrinsic events");
                continue;
            }
        };
        let transfers = match events.all::<Transfer>() {
            Ok(transfers) => transfers,
            Err(e) => {
                tracing::error!(error = %e, tx_hash = %tx_hash_hex, "failed to decode transfer events");
                continue;
            }
        };
        if !is_deposit_confirmed(
            events.is_extrinsic_success_present(),
            &transfers,
            account_id,
            dest,
            balances_call.value,
        ) {
            tracing::warn!(tx_hash = %tx_hash_hex, "deposit extrinsic did not transfer funds, skipping");
            continue;
        }

        let ascii_remark = hex::encode(remark_call.remark.clone());
        tracing::info!(
            tx_hash = %tx_hash_hex,
            account = %account_id_hex,
            block_height = block_height,
            block_hash = ?block_hash,
            ascii_remark = %ascii_remark,
            "found matching batch call"
        );

        let receipt = Deposit {
            token_address: "0x0000000000000000000000000000000000000000".to_string(),
            amount: balances_call.value.to_string(),
            _from: account_id_hex,
        };

        // One bad deposit (invalid remark, replayed order) must not block the rest of the block.
        if let Err(e) = utils
            .update_database_on_deposit(
                &ascii_remark,
                &receipt,
                &tx_hash_hex,
                &mut connection,
                0,
                &"PROCESSED".to_string(),
            )
            .await
        {
            tracing::error!(
                error = %e,
                tx_hash = %tx_hash_hex,
                ascii_remark = %ascii_remark,
                "failed to update database on deposit"
            );
        }
    }

    utils
        .update_finalised_block_number(block_height as i32, block_hash_hex, &mut connection, 0)
        .await
        .map_err(|e| format!("Failed to update finalised block number: {}", e))?;

    Ok(())
}

/// A decoded call only shows what was requested; a reverted `batch_all` stays in the block body.
/// Credit a deposit only if the extrinsic succeeded and emitted the matching transfer.
fn is_deposit_confirmed(
    extrinsic_succeeded: bool,
    transfers: &[Transfer],
    from: &AccountId,
    to: &AccountId,
    amount: u128,
) -> bool {
    extrinsic_succeeded
        && transfers
            .iter()
            .any(|t| t.from == *from && t.to == *to && t.amount == amount)
}

#[cfg(test)]
mod tests {
    use super::*;

    const AMOUNT: u128 = 1_000_000_000_000_000_000_000_000;

    fn sender() -> AccountId {
        AccountId::from([1u8; 32])
    }

    fn deposit_address() -> AccountId {
        AccountId::from([2u8; 32])
    }

    fn transfer(from: AccountId, to: AccountId, amount: u128) -> Transfer {
        Transfer { from, to, amount }
    }

    fn confirmed(succeeded: bool, transfers: &[Transfer]) -> bool {
        is_deposit_confirmed(succeeded, transfers, &sender(), &deposit_address(), AMOUNT)
    }

    #[test]
    fn deposit_is_confirmed_when_extrinsic_succeeded_with_matching_transfer() {
        assert!(confirmed(
            true,
            &[transfer(sender(), deposit_address(), AMOUNT)]
        ));
    }

    #[test]
    fn deposit_is_rejected_when_extrinsic_failed() {
        assert!(!confirmed(false, &[]));
        assert!(!confirmed(
            false,
            &[transfer(sender(), deposit_address(), AMOUNT)]
        ));
    }

    #[test]
    fn deposit_is_rejected_without_transfer_event() {
        assert!(!confirmed(true, &[]));
    }

    #[test]
    fn deposit_is_rejected_when_transfer_does_not_match() {
        assert!(!confirmed(
            true,
            &[transfer(sender(), deposit_address(), AMOUNT - 1)]
        ));
        assert!(!confirmed(true, &[transfer(sender(), sender(), AMOUNT)]));
        assert!(!confirmed(
            true,
            &[transfer(deposit_address(), deposit_address(), AMOUNT)]
        ));
    }
}

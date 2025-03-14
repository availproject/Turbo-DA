use avail::runtime_types::da_runtime::RuntimeCall;
use avail::runtime_types::frame_system::pallet::Call::remark_with_event as RemarkWithEvent;
use avail::runtime_types::pallet_balances::pallet::Call::transfer_keep_alive as TransferKeepAlive;
use avail::utility::calls::types::BatchAll;
use avail_rust::{avail, block, error::ClientError, subxt, Block, Filter, Options, SDK};
use log::{error, info};
use subxt::utils::MultiAddress;

use crate::config::Config;

pub async fn run(endpoint: String) -> Result<(), ClientError> {
    info!("Starting Avail Chain Monitor");
    let sdk = SDK::new(endpoint.as_str()).await?;
    info!("SDK initialized with local endpoint");

    let mut stream = sdk.client.blocks().subscribe_finalized().await?;
    while let Some(avail_block) = stream.next().await {
        match avail_block {
            Ok(avail_block) => {
                let block: Block = Block::from_block(avail_block).await?;

                info!("Filtering batch calls from block");

                let all_batch_calls = block.transactions_static::<BatchAll>(Filter::new());
                info!("Filtering batch calls from block");

                // Filtering
                for batch_all in all_batch_calls {
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
                    info!(
                        "Found matching batch call - Destination: {}, Value: {}, Remark: {:?}",
                        acc_string, value, ascii_remark
                    );
                }
            }
            Err(e) => {
                error!("Error fetching block: {}", e);
            }
        }
    }

    info!("Avail run completed successfully");
    Ok(())
}

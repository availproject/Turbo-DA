use std::str::FromStr;

use alloy::{
    primitives::Address,
    providers::{Provider, ProviderBuilder, RootProvider, WsConnect},
    pubsub::PubSubFrontend,
    rpc::types::{Filter, Log},
    sol,
    sol_types::SolEvent,
};
use serde_json::json;

use crate::utils::{Deposit as EvmDeposit, Utils};
use crate::Config;
use futures_util::stream::StreamExt;
use std::sync::Arc;
use turbo_da_core::logger::{debug, debug_json, error, info_json};

sol! {
    struct Encoder{bytes userID; address tokenAddress; uint256 amount; address recipient; uint256 nonce;}
}

sol! {
    event Deposit(
        bytes32 indexed orderId,
        address indexed tokenAddress,
        uint256 amount,
        address from
    );
}

pub(crate) struct EVM {
    provider: RootProvider<PubSubFrontend>,
    evm_chain_id: i32,
    contract_address: String,
    finalised_threshold: u64,
    start_block: u64,
    utils: Utils,
}

impl EVM {
    pub async fn new(
        contract_adress: String,
        ws_url: String,
        evm_chain_id: i32,
        finalised_threshold: u64,
        start_block: u64,
        cfg: Arc<Config>,
    ) -> Result<Self, String> {
        let ws = WsConnect::new(ws_url);

        let provider = ProviderBuilder::new()
            .on_ws(ws)
            .await
            .map_err(|e| format!("Failed to connect to Turbo DA Contract: {:?}", e))?;

        Ok(Self {
            provider,
            evm_chain_id,
            contract_address: contract_adress,
            finalised_threshold,
            start_block,
            utils: Utils::new(
                cfg.coin_gecho_api_url.clone(),
                cfg.coin_gecho_api_key.clone(),
                cfg.database_url.clone(),
                cfg.avail_rpc_url.clone(),
            ),
        })
    }

    pub async fn monitor_evm_chain(&mut self) {
        info_json(json!({
            "message": "Monitor service started",
            "contract_address": self.contract_address,
            "finalised_threshold": self.finalised_threshold,
            "level": "info"
        }));

        let subscription = match self.provider.subscribe_blocks().await {
            Ok(s) => s,
            Err(e) => return error(&format!("{}", e.to_string())),
        };
        let mut _stream = subscription.into_stream();

        while let Some(header) = _stream.next().await {
            info_json(json!({
                "header": header.number,
                "level": "info"
            }));
            let finalised_block = header.inner.number - self.finalised_threshold;

            match self.check_deposits(finalised_block).await {
                Ok(_) => debug(&format!("Deposits checked successfully")),
                Err(e) => error(&format!("Failed to check deposits: {}", e)),
            }
        }
    }

    async fn check_deposits(&mut self, number: u64) -> Result<(), String> {
        let filter = Filter::new()
            .address(Address::from_str(&self.contract_address).unwrap())
            .event("Deposit(bytes32,address,uint256,address)")
            .from_block(self.start_block)
            .to_block(number);
        let logs = self
            .provider
            .get_logs(&filter)
            .await
            .map_err(|e| format!("Failed to get logs: {}", e))?;
        self.start_block = number + 1;
        for log in logs {
            debug_json(json!({
                "message": "Log from our contract",
                "block_hash": log.block_hash,
                "block_number": log.block_number,
                "transaction_hash": log.transaction_hash,
                "transaction_index": log.transaction_index,
                "log_index": log.log_index,
                "level": "debug"
            }));
            let receipt = match self.process_deposit_event(&log) {
                Ok(receipt) => receipt,
                Err(e) => {
                    error(&format!("Failed to process deposit event: {}", e));
                    continue;
                }
            };

            let mut connection = match self.utils.establish_connection() {
                Ok(conn) => conn,
                Err(e) => {
                    error(&format!("Failed to establish database connection: {}", e));
                    continue;
                }
            };

            let Some(number) = log.block_number else {
                error(&format!("Block number not found"));
                continue;
            };
            let Some(hash) = log.block_hash else {
                error(&format!("Block hash not found"));
                continue;
            };

            if let Err(e) = self
                .utils
                .update_finalised_block_number(
                    number as i32,
                    hash.to_string(),
                    &mut connection,
                    self.evm_chain_id,
                )
                .await
            {
                error(&format!("Failed to update finalised block number: {}", e));
            }

            let tx_hash = match log.transaction_hash {
                Some(tx_hash) => tx_hash.to_string(),
                None => {
                    error(&format!("Transaction hash not found"));
                    continue;
                }
            };

            let deposit = EvmDeposit {
                token_address: receipt.tokenAddress.to_string(),
                amount: receipt.amount.to_string(),
                _from: receipt.from.to_string(),
            };
            let result = self
                .utils
                .update_database_on_deposit(
                    &receipt.orderId.to_string(),
                    &deposit,
                    &tx_hash,
                    &mut connection,
                    self.evm_chain_id,
                    &"Processed".to_string(),
                )
                .await;
            if let Err(e) = result {
                error(&format!("Failed to update database: {}", e));
            }
        }
        Ok(())
    }

    fn process_deposit_event(&self, log: &Log) -> Result<Deposit, String> {
        let event_receipt = Deposit::decode_log_data(&log.data(), true)
            .map_err(|e| format!("Failed to decode log data: {}", e))?;

        Ok(event_receipt)
    }
}

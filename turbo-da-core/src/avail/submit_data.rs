// This file is part of Avail Gas Relay Service.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use alloy::hex::ToHexExt;
/// Core logic of generating extrinsic and submitting to Avail DA.
use avail_rust::{
    avail::{self},
    prelude::WebSocket,
    Keypair,
    Nonce::BestBlockAndTxPool,
    Options, H256, SDK,
};
use log::error;
use tokio::sync::Mutex;

pub static LOCK: Mutex<()> = Mutex::const_new(());

#[derive(Debug)]
pub struct TransactionInfo {
    pub to_address: String,
    pub data_hash: String,
    pub tx_hash: String,
    pub block_hash: String,
    pub gas_fee: u128,
    pub extrinsic_index: u32,
    pub block_number: u32,
}

pub struct SubmitDataTxSuccess {
    pub block_number: u32,
    pub tx_hash: H256,
    pub block_hash: H256,
    pub extrinsic_index: u32,
    pub fee: u128,
}

pub struct SubmitDataAvail<'a> {
    client: &'a SDK,
    account: &'a Keypair,
    app_id: i32,
}

impl<'a> SubmitDataAvail<'a> {
    pub fn new(client: &'a SDK, account: &'a Keypair, app_id: i32) -> Self {
        SubmitDataAvail {
            client,
            account,
            app_id,
        }
    }
    pub async fn submit_data(&self, data: &[u8]) -> Result<TransactionInfo, String> {
        let options = Some(
            Options::new()
                .nonce(BestBlockAndTxPool)
                .app_id(self.app_id as u32),
        );
        let tx = self.client.tx.data_availability.submit_data(data.to_vec());

        let res = tx.execute_and_watch_inclusion(&self.account, options).await;
        let fee = tx.payment_query_fee_details(&self.account, options).await;

        match (res, fee) {
            (Ok(tx_in_block), Ok(fee)) => {
                let data_hash = match tx_in_block
                    .events
                    .find_first::<avail::data_availability::events::DataSubmitted>(
                ) {
                    Ok(Some(event)) => event.data_hash,
                    Ok(None) => return Err("DataSubmitted event not found".to_string()),
                    Err(e) => return Err(format!("Error finding DataSubmitted event: {}", e)),
                };

                Ok(TransactionInfo {
                    block_number: tx_in_block.block_number,
                    tx_hash: hex::encode(tx_in_block.tx_hash.as_bytes()),
                    block_hash: hex::encode(tx_in_block.block_hash.as_bytes()),
                    extrinsic_index: tx_in_block.tx_index,
                    gas_fee: fee.final_fee(),
                    to_address: self.account.public_key().encode_hex(),
                    data_hash: hex::encode(data_hash.as_bytes()),
                })
            }
            (Err(e), _) => {
                error!("Couldn't submit data with error {:?}", e);
                Err(e.to_string())
            }
            (Ok(_), Err(e)) => {
                error!("Couldn't submit data with error {:?}", e);
                Err("Couldn't submit data".to_string())
            }
        }
    }
}

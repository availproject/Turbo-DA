//! Submission and retrieval for the normal Avail network, which needs the older SDK release.

use avail_rust_legacy::avail::data_availability::{events::DataSubmitted, tx::SubmitData};
use avail_rust_legacy::block::BlockExtrinsicsQuery;
use avail_rust_legacy::prelude::*;
pub use avail_rust_legacy::{Client, Keypair};
use hex::{self, ToHex};

use crate::submit_data::TransactionInfo;

/// Posts data to the normal network with a `submit_data` extrinsic.
pub struct SubmitDataNormal<'a> {
    pub client: &'a Client,
    pub account: &'a Keypair,
    pub app_id: i32,
}

impl SubmitDataNormal<'_> {
    pub async fn submit_data(&self, data: &[u8]) -> Result<TransactionInfo, String> {
        let options = Options::new(self.app_id as u32);
        let submittable = self
            .client
            .tx()
            .data_availability()
            .submit_data(data.to_vec());

        let estimated_fees = submittable
            .estimate_extrinsic_fees(self.account, options, None)
            .await
            .map_err(|e| e.to_string())?;

        let submitted = submittable
            .sign_and_submit(self.account, options)
            .await
            .map_err(|e| e.to_string())?;

        let receipt = submitted.receipt(false).await.map_err(|e| e.to_string())?;
        let Some(receipt) = receipt else {
            return Err("Transaction was dropped".into());
        };

        let events = receipt.events().await.map_err(|e| e.to_string())?;
        if !events.is_extrinsic_success_present() {
            return Err("Transaction was executed but execution failed.".into());
        }

        let Some(event) = events.first::<DataSubmitted>() else {
            return Err("Failed to find DataSubmitted event. Something went horribly wrong".into());
        };

        Ok(TransactionInfo {
            block_number: receipt.block_height,
            tx_hash: hex::encode(receipt.ext_hash.0),
            block_hash: hex::encode(receipt.block_hash.0),
            extrinsic_index: receipt.ext_index,
            gas_fee: estimated_fees.final_fee(),
            to_address: self.account.public_key().encode_hex(),
            data_hash: hex::encode(event.data_hash.0),
        })
    }

    pub async fn estimate_fee(&self, data: Vec<u8>) -> Result<u128, String> {
        let fees = self
            .client
            .tx()
            .data_availability()
            .submit_data(data)
            .estimate_extrinsic_fees(self.account, Options::default(), None)
            .await
            .map_err(|e| e.to_string())?;

        Ok(fees.final_fee())
    }
}

/// Reads submitted data back from a normal network block.
pub async fn retrieve_data(
    client: Client,
    block_hash: [u8; 32],
    tx_index: u32,
) -> Result<Vec<u8>, String> {
    let block_hash = H256::from(block_hash);
    let block = BlockExtrinsicsQuery::new(client, block_hash.into());
    let tx = block.get::<SubmitData>(tx_index).await;
    let tx = tx.map_err(|e| e.to_string())?;

    let Some(tx) = tx else {
        return Err(format!(
            "Failed to find SubmitData. Block hash: {block_hash:?}, Tx index: {tx_index}"
        ));
    };

    Ok(tx.call.data)
}

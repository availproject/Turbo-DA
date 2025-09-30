use avail::data_availability::events::DataSubmitted;
/// Core logic of generating extrinsic and submitting to Avail DA.
use avail_rust::prelude::*;
use hex::{self, ToHex};

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

pub struct SubmitDataAvail<'a> {
    pub client: &'a Client,
    pub account: &'a Keypair,
    pub app_id: i32,
}

impl<'a> SubmitDataAvail<'a> {
    pub fn new(client: &'a Client, account: &'a Keypair, app_id: i32) -> Self {
        SubmitDataAvail {
            client,
            account,
            app_id,
        }
    }
    pub async fn submit_data(&self, data: &[u8]) -> Result<TransactionInfo, String> {
        let options = Options::new(self.app_id as u32);
        let submittable = self
            .client
            .tx()
            .data_availability()
            .submit_data(data.to_vec());

        let estimated_fees = submittable
            .estimate_extrinsic_fees(&self.account, options, None)
            .await
            .map_err(|e| e.to_string())?;

        let submitted = submittable
            .sign_and_submit(&self.account, options)
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
            block_number: receipt.block_ref.height,
            tx_hash: hex::encode(receipt.tx_ref.hash.0),
            block_hash: hex::encode(receipt.block_ref.hash.0),
            extrinsic_index: receipt.tx_ref.index,
            gas_fee: estimated_fees.final_fee(),
            to_address: self.account.public_key().encode_hex(),
            data_hash: hex::encode(event.data_hash.0),
        })
    }
}

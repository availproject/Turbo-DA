use avail_fri::BlobCommitment;
use avail_rust::avail_rust_core::avail::babe::storage::BabeRandomness;
use avail_rust::ext::sp_crypto_hashing::keccak_256;
use avail_rust::prelude::*;
use avail_rust::FindBlobExtOutcome;
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
        let options = Options::new();
        let data_hash = H256::from(keccak_256(data));
        let randomness = BabeRandomness::fetch(&self.client.rpc_client, None)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Failed to fetch Babe randomness".to_string())?;
        let commitment = BlobCommitment::compute(&randomness, data, &data_hash.0)
            .map_err(|e| e.to_string())?;

        let metadata_ext = self
            .client
            .tx()
            .data_availability()
            .submit_blob_metadata(
                self.app_id as u32,
                data_hash,
                data.len() as u64,
                commitment.commitment.clone(),
                commitment.seed,
                commitment.claim,
            );

        let estimated_fees = metadata_ext
            .estimate_extrinsic_fees(&self.account, options, None)
            .await
            .map_err(|e| e.to_string())?;

        let outcome = self
            .client
            .blob()
            .submit_with_metadata_and_watch(
                self.app_id as u32,
                data,
                data_hash,
                commitment.commitment,
                commitment.seed,
                commitment.claim,
                self.account,
                options,
                BlockQueryMode::Best,
            )
            .await
            .map_err(|e| e.to_string())?;

        let receipt = match outcome {
            FindBlobExtOutcome::Found(found) => found.receipt,
            FindBlobExtOutcome::NotFound => return Err("Blob metadata transaction was not found".into()),
            FindBlobExtOutcome::TimedOut => return Err("Timed out waiting for blob metadata transaction".into()),
        };

        Ok(TransactionInfo {
            block_number: receipt.block_height,
            tx_hash: hex::encode(receipt.ext_hash.0),
            block_hash: hex::encode(receipt.block_hash.0),
            extrinsic_index: receipt.ext_index,
            gas_fee: estimated_fees.final_fee(),
            to_address: self.account.public_key().encode_hex(),
            data_hash: hex::encode(data_hash.0),
        })
    }
}

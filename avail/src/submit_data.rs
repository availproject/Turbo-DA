use avail::data_availability::events::DataSubmitted;
use avail_rust::{
    avail::babe::storage::BabeRandomness, ext::sp_crypto_hashing::keccak_256, prelude::*,
    submission::submitted::WaitOption,
};
use const_hex::{self, ToHexExt};

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
        let randomness = BabeRandomness::fetch(&self.client.rpc_client, None)
            .await
            .map_err(|e| e.to_string())?;
        let Some(randomness) = randomness else {
            return Err(String::from(
                "Cannot submit data if babe randomness is not available",
            ));
        };

        let data_hash = keccak_256(data);
        let commitment = avail_fri::BlobCommitment::compute(&randomness, data, &data_hash)
            .map_err(|e| e.to_string())?;

        self.client
            .blob()
            .submit_blob_and_blob_metadata(
                self.app_id as u32,
                data,
                H256::from(data_hash),
                commitment.commitment,
                Some(commitment.seed),
                Some(commitment.claim),
                self.account,
                Default::default(),
            )
            .await
            .map_err(|e| e.to_string())?;

        // TODO
        todo!()
    }
}

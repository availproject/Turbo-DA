use avail_rust::{
    avail::babe::storage::BabeRandomness, ext::sp_crypto_hashing::keccak_256, prelude::*,
};

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

        let outcome = self
            .client
            .blob()
            .submit_with_metadata_and_watch(
                self.app_id as u32,
                data,
                H256::from(data_hash),
                commitment.commitment,
                Some(commitment.seed),
                Some(commitment.claim),
                self.account,
                Default::default(),
                WaitOption::default(),
            )
            .await
            .map_err(|e| e.to_string())?;

        let FoundBlobExt { receipt, summary } = match outcome {
            FindBlobExtOutcome::Found(x) => x,
            FindBlobExtOutcome::NotFound => {
                return Err(String::from(
                    "Could not find submitted transaction. Reason: Not Found",
                ));
            }
            FindBlobExtOutcome::TimedOut => {
                return Err(String::from(
                    "Could not find submitted transaction. Reason: TimeOut",
                ));
            }
        };

        // TODO
        todo!()
    }
}

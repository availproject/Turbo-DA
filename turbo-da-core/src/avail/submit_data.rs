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
    pub(crate) client: &'a SDK,
    pub(crate) account: &'a Keypair,
    pub(crate) app_id: i32,
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
                    .find_first_event::<avail::data_availability::events::DataSubmitted>()
                {
                    Some(event) => event.data_hash,
                    None => return Err("Data submitted event not found".to_string()),
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

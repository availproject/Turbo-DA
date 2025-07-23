/// Core logic of generating extrinsic and submitting to Avail DA.
use crate::commitment_gen::build_da_commitments;
use avail_rust::prelude::*;
use hex::{self, ToHex};

#[derive(codec::Decode, codec::Encode, PartialEq, Eq)]
pub struct DataSubmissionEvent {
    pub who: AccountId,
    pub data_hash: H256,
}
impl HasEventEmittedIndex for DataSubmissionEvent {
    const EMITTED_INDEX: (u8, u8) = (29, 1);
}

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
        let options = Options::new(Some(self.app_id as u32));

        let commitments = build_da_commitments(data.to_vec(), 1024, 1024, [0u8; 32])
            .map_err(|e| e.to_string())?;

        let tx = self
            .client
            .tx()
            .data_availability()
            .submit_data_with_commitments(data.to_vec(), commitments);

        let fees = tx
            .estimate_call_fees(None)
            .await
            .map_err(|e| e.to_string())?;

        let res = tx
            .sign_and_submit(&self.account, options)
            .await
            .map_err(|e| e.to_string())?;

        let receipt = match res.receipt(true).await.map_err(|e| e.to_string())? {
            Some(receipt) => receipt,
            None => return Err("Transaction failed".to_string()),
        };

        let events_group = receipt.tx_events().await.map_err(|e| e.to_string())?;
        let event = events_group
            .events
            .iter()
            .find(|x| x.emitted_index == DataSubmissionEvent::EMITTED_INDEX)
            .expect("Must be there");

        let encoded_event = event
            .encoded
            .as_ref()
            .ok_or_else(|| "Encoded event not found".to_string())?;
        let encoded_event =
            hex::decode(encoded_event.trim_start_matches("0x")).map_err(|e| e.to_string())?;

        let event = DataSubmissionEvent::from_raw(&encoded_event)
            .ok_or_else(|| "Event not found".to_string())?;

        Ok(TransactionInfo {
            block_number: receipt.block_loc.height,
            tx_hash: hex::encode(res.tx_hash.as_bytes()),
            block_hash: hex::encode(receipt.block_loc.hash),
            extrinsic_index: receipt.tx_loc.index,
            gas_fee: fees.final_fee(),
            to_address: self.account.public_key().encode_hex(),
            data_hash: hex::encode(event.data_hash.as_bytes()),
        })
    }
}

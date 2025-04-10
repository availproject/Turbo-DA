use avail_rust::hex::ToHex;
/// Core logic of generating extrinsic and submitting to Avail DA.
use avail_rust::prelude::*;
use avail_rust::transactions::SystemEvents::ExtrinsicFailed;
use hex;

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
        let options = Options::new().app_id(self.app_id as u32);
        let tx = self.client.tx.data_availability.submit_data(data.to_vec());

        let res = tx
            .execute_and_watch_finalization(&self.account, options)
            .await
            .map_err(|e| e.to_string())?;
        let fee = tx
            .payment_query_fee_details(&self.account, Some(options))
            .await
            .map_err(|e| e.to_string())?;

        let success = res
            .is_successful()
            .ok_or_else(|| "Couldn't determine if tx failed".to_string())?;

        let events = res.events.ok_or_else(|| "No events found".to_string())?;

        if !success {
            let failure_event = events
                .find_first::<ExtrinsicFailed>()
                .ok_or_else(|| "Transaction failed but no failure event found".to_string())?
                .ok_or_else(|| "Event found but failed to decode it")?;
            return Err(format!(
                "Transaction failed: {:?}",
                failure_event.dispatch_error
            ));
        }
        let event = events
            .find_first::<avail::data_availability::events::DataSubmitted>()
            .ok_or_else(|| "Data submitted event not found".to_string())?
            .ok_or_else(|| "Event found but failed to decode it")?;

        Ok(TransactionInfo {
            block_number: res.block_number,
            tx_hash: hex::encode(res.tx_hash.as_bytes()),
            block_hash: hex::encode(res.block_hash.as_bytes()),
            extrinsic_index: res.tx_index,
            gas_fee: fee.final_fee(),
            to_address: self.account.public_key().encode_hex(),
            data_hash: hex::encode(event.data_hash.as_bytes()),
        })
    }
}

use avail_rust::{
    avail::data_availability::tx::SubmitData,
    avail_rust_core::rpc::system::fetch_extrinsics_v1_types::EncodeSelector, prelude::*,
};
use codec::Decode;
pub async fn retrieve_data(
    client: Client,
    block_number: u32,
    tx_index: u32,
) -> Result<Vec<u8>, String> {
    let tx = client
        .block_client()
        .block_transaction(
            block_number.into(),
            tx_index.into(),
            None,
            Some(EncodeSelector::Call),
        )
        .await
        .map_err(|e| e.to_string())?
        .expect("Must be there");
    let encoded_call = hex::decode(tx.encoded.expect("Must be there")).expect("");
    let sd = SubmitData::decode(&mut &encoded_call[2..]).expect("Should work");

    Ok(sd.data)
}

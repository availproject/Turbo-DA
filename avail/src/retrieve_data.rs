use avail_rust::{BlockWithTx, Client, H256, avail::data_availability::tx::SubmitData};

pub async fn retrieve_data(
    client: Client,
    block_hash: H256,
    tx_index: u32,
) -> Result<Vec<u8>, String> {
    let block = BlockWithTx::new(client, block_hash);
    let tx = block.get::<SubmitData>(tx_index).await;
    let tx = tx.map_err(|e| e.to_string())?;

    let Some(tx) = tx else {
        let message = std::format!(
            "Failed to find SubmitData. Block hash: {:?}, Tx index: {}",
            block_hash,
            tx_index,
        );
        return Err(message);
    };

    Ok(tx.call.data)
}

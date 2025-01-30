use avail_rust::{block::Block, subxt::Error, H256, SDK};

pub async fn retrieve_data(client: SDK, block_hash: H256, tx_index: u32) -> Result<Vec<u8>, Error> {
    let block = match Block::new(&client.online_client, block_hash).await {
        Ok(block) => block,
        Err(e) => return Err(Error::from(e.to_string())),
    };

    let da_submission = match block.data_submissions_by_index(tx_index) {
        Some(da_submission) => da_submission,
        None => return Err(Error::from("Data submission not found")),
    };

    Ok(da_submission.data)
}

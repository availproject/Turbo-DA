use avail_rust::{Filter, H256, SDK, block::Block, subxt::Error};

pub async fn retrieve_data(client: SDK, block_hash: H256, tx_index: u32) -> Result<Vec<u8>, Error> {
    let block = match Block::new(&client.client, block_hash).await {
        Ok(block) => block,
        Err(e) => return Err(Error::from(e.to_string())),
    };

    let da_submission = block.data_submissions(Filter::new().tx_index(tx_index));

    Ok(da_submission[0].data.clone())
}

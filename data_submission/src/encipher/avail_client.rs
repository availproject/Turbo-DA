use avail_rust::{error::ClientError, Block, Filter, H256, SDK};
use std::str::FromStr;

/// Avail client
///
/// # Arguments
/// * `avail_rpc_url` - The URL of the Avail RPC endpoint
///
/// # Returns
/// * `AvailClient` - The Avail client
pub struct AvailDaClient {
    pub sdk: SDK,
}

/// Avail client implementation
impl AvailDaClient {
    /// Create a new Avail client
    ///
    /// # Arguments
    /// * `avail_rpc_url` - The URL of the Avail RPC endpoint
    ///
    /// # Returns
    /// * `AvailClient` - The Avail client
    pub async fn new(avail_rpc_url: String) -> Result<Self, ClientError> {
        let sdk = SDK::new(avail_rpc_url.as_str()).await?;
        Ok(Self { sdk })
    }

    /// Get the data submission from the tx hash
    ///
    /// # Arguments
    /// * `tx_hash` - The tx hash
    /// * `block_hash` - The block hash
    ///
    /// # Returns
    /// * `Vec<u8>` - The data submission
    pub async fn get_data_submission_from_tx_hash(
        &self,
        tx_hash: String,
        block_hash: String,
    ) -> Result<Vec<u8>, ClientError> {
        let block = Block::new(
            &self.sdk.client,
            H256::from_str(block_hash.as_str()).unwrap(),
        )
        .await?;
        let blobs = block
            .data_submissions(Filter::new().tx_hash(H256::from_str(tx_hash.as_str()).unwrap()));
        let payload = blobs.first().unwrap().data.clone();
        Ok(payload)
    }
}

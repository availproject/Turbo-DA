use std::time::Duration;

use reqwest::Client;
use types::{DecryptRequest, EncryptRequest, EncryptResponse};
use uuid::Uuid;

use crate::types::{
    DecryptRequestData, DecryptResponse, GetDecryptRequestStatusRequest,
    GetDecryptRequestStatusResponse, RequestStatus,
};

pub mod types;

/// Enigma encryption service
///
/// # Arguments
/// * `service_url` - The URL of the Enigma service
/// * `service_version` - The version of the Enigma service
pub struct EnigmaEncryptionService {
    pub(crate) service_url: String,
    pub(crate) service_version: String,
}

/// Enigma encryption service implementation
///
/// # Arguments
/// * `service_url` - The URL of the Enigma service
/// * `service_version` - The version of the Enigma service
impl EnigmaEncryptionService {
    pub fn new(service_url: String, service_version: String) -> Self {
        Self {
            service_url,
            service_version,
        }
    }

    /// Encrypts the payload using the Enigma service
    ///
    /// # Arguments
    /// * `payload` - EncryptRequest struct containing app_id and plaintext
    ///
    /// # Returns
    /// * `Vec<u8>` - The encrypted data
    pub async fn encrypt(&self, payload: EncryptRequest) -> Result<Vec<u8>, reqwest::Error> {
        let response = Client::new()
            .post(format!(
                "{}/{}/encrypt",
                self.service_version.clone(),
                self.service_url.clone()
            ))
            .json(&payload)
            .send()
            .await?;
        let response = response.json::<EncryptResponse>().await?;
        Ok(self.format_encrypt_response_to_data_submission(response))
    }

    /// Decrypts the payload using the Enigma service
    ///
    /// # Arguments
    /// * `payload` - DecryptRequest struct containing app_id, ciphertext, and ephemeral_pub_key
    ///
    /// # Returns
    /// * `Uuid` - The job id of the decryption job
    pub async fn decrypt(&self, payload: DecryptRequest) -> Result<Uuid, reqwest::Error> {
        let response = Client::new()
            .post(format!(
                "{}/{}/decrypt",
                self.service_version.clone(),
                self.service_url.clone()
            ))
            .json(&payload)
            .send()
            .await?;
        let response = response.json::<DecryptResponse>().await?;
        Ok(response.job_id)
    }

    pub async fn get_decrypt_request_data(
        &self,
        job_id: Uuid,
    ) -> Result<DecryptRequestData, reqwest::Error> {
        let request = GetDecryptRequestStatusRequest { job_id };
        let response = Client::new()
            .get(format!(
                "{}/{}/decrypt-status",
                self.service_version.clone(),
                self.service_url.clone(),
            ))
            .json(&request)
            .send()
            .await?;
        let response = response.json::<GetDecryptRequestStatusResponse>().await?;
        Ok(response.request)
    }

    // format the encrypt response to the data submission format
    // | ephemeral_pub_key (constant size 65 bytes) | ciphertext (encrypted DA payload) |
    // * Here we are assuming that the ephemeral_pub_key is returned in the uncompressed format.
    fn format_encrypt_response_to_data_submission(&self, payload: EncryptResponse) -> Vec<u8> {
        let mut formatted_payload = Vec::new();
        formatted_payload.extend_from_slice(&payload.ephemeral_pub_key);
        formatted_payload.extend_from_slice(&payload.ciphertext);
        formatted_payload
    }
}

const DEFAULT_REQUEST_DATA_TIMEOUT: u32 = 25;
const DEFAULT_REQUEST_DATA_FETCH_INTERVAL: u32 = 5;

pub async fn decrypt_request_data_fetch_listener(
    enigma_encryption_service: EnigmaEncryptionService,
    job_id: Uuid,
    request_data_timeout: Option<u32>,
    request_data_fetch_interval: Option<u32>,
) -> Result<DecryptRequestData, anyhow::Error> {
    let timeout =
        Duration::from_secs(request_data_timeout.unwrap_or(DEFAULT_REQUEST_DATA_TIMEOUT) as u64);
    let interval = Duration::from_secs(
        request_data_fetch_interval.unwrap_or(DEFAULT_REQUEST_DATA_FETCH_INTERVAL) as u64,
    );

    let start = tokio::time::Instant::now();
    let mut timer = tokio::time::interval(interval);

    loop {
        // Fetch immediately, then wait for the next tick
        match enigma_encryption_service
            .get_decrypt_request_data(job_id)
            .await
        {
            Ok(request_data) => match request_data.status {
                RequestStatus::Completed => return Ok(request_data),
                RequestStatus::Failed => return Err(anyhow::anyhow!("Decryption failed")),
                _ => {} // Continue polling
            },
            Err(e) => {
                return Err(anyhow::anyhow!(
                    "Error fetching decrypt request data: {}",
                    e
                ));
            }
        }

        if start.elapsed() > timeout {
            return Err(anyhow::anyhow!("Timeout waiting for decrypt request data"));
        }

        timer.tick().await;
    }
}

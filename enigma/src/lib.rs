use reqwest::Client;
use types::{DecryptRequest, DecryptResponse, EncryptRequest, EncryptResponse};

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
            .post(format!("{}/v1/encrypt", self.service_url.clone()))
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
    /// * `Vec<u8>` - The decrypted data
    pub async fn decrypt(&self, payload: DecryptRequest) -> Result<Vec<u8>, reqwest::Error> {
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
        Ok(response.plaintext)
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

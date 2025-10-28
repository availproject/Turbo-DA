use reqwest::Client;
use types::{DecryptRequest, DecryptRequestData, EncryptRequest, EncryptResponse};

pub mod types;

/// Enigma encryption service
///
/// # Arguments
/// * `service_url` - The URL of the Enigma service
/// * `service_version` - The version of the Enigma service
#[derive(Clone)]
pub struct EnigmaEncryptionService {
    pub(crate) service_url: String,
}

/// Enigma encryption service implementation
///
/// # Arguments
/// * `service_url` - The URL of the Enigma service
impl EnigmaEncryptionService {
    pub fn new(service_url: String) -> Self {
        Self { service_url }
    }

    /// Encrypts the payload using the Enigma service
    ///
    /// # Arguments
    /// * `payload` - EncryptRequest struct containing app_id and plaintext
    ///
    /// # Returns
    /// * `Vec<u8>` - The encrypted data
    pub async fn encrypt(
        &self,
        payload: EncryptRequest,
    ) -> Result<EncryptResponse, reqwest::Error> {
        let response = Client::new()
            .post(format!("{}/v1/encrypt", self.service_url.clone()))
            .json(&payload)
            .send()
            .await?;
        let response = response.json::<EncryptResponse>().await?;
        Ok(response)
    }

    /// Decrypts the payload using the Enigma service
    ///
    /// # Arguments
    /// * `payload` - DecryptRequest struct containing app_id, ciphertext, and ephemeral_pub_key
    ///
    /// # Returns
    /// * `Vec<u8>` - The decrypted data
    pub async fn decrypt(
        &self,
        payload: DecryptRequest,
    ) -> Result<DecryptRequestData, reqwest::Error> {
        let response = Client::new()
            .post(format!("{}/v1/decrypt", self.service_url.clone()))
            .json(&payload)
            .send()
            .await?;

        let response = response.json::<DecryptRequestData>().await?;
        Ok(response)
    }

    // format the encrypt response to the data submission format
    // | ephemeral_pub_key (constant size 65 bytes) | ciphertext (encrypted DA payload) |
    // * Here we are assuming that the ephemeral_pub_key is returned in the uncompressed format.
    pub fn format_encrypt_response_to_data_submission(&self, payload: &EncryptResponse) -> Vec<u8> {
        let mut formatted_payload = Vec::new();
        formatted_payload.extend_from_slice(&payload.ephemeral_pub_key);
        formatted_payload.extend_from_slice(&payload.ciphertext);
        formatted_payload
    }
}

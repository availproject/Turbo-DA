use reqwest::Client;
use types::EncryptResponse;

mod types;

pub struct EncipherEncryptionService {
    pub(crate) service_url: String,
    pub(crate) service_version: String,
}

impl EncipherEncryptionService {
    pub fn new(service_url: String, service_version: String) -> Self {
        Self {
            service_url,
            service_version,
        }
    }

    pub async fn encrypt(&self, payload: Vec<u8>) -> Result<Vec<u8>, reqwest::Error> {
        let response = Client::new()
            .post(format!(
                "{}/{}/encrypt",
                self.service_version.clone(),
                self.service_url.clone()
            ))
            .body(payload)
            .send()
            .await?;
        let response = response.json::<EncryptResponse>().await?;
        Ok(self.format_encrypt_response_to_data_submission(response))
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

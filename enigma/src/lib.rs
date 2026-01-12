use std::{env, fs};

use reqwest::{Certificate, Client, Identity};
use types::{
    AddParticipantRequest, AddParticipantResponse, DecryptRequest, DecryptRequestData,
    DecryptRequestResponse, DeleteParticipantRequest, DeleteParticipantResponse, EncryptRequest,
    EncryptResponse, RegisterRequest, RegisterResponse, SubmitSignatureRequest,
    SubmitSignatureResponse,
};

pub mod types;

/// Enigma encryption service
///
/// # Arguments
/// * `service_url` - The URL of the Enigma service
/// * `service_version` - The version of the Enigma service
#[derive(Clone)]
pub struct EnigmaEncryptionService {
    pub(crate) service_url: String,
    client: Client,
}

/// Enigma encryption service implementation
///
/// # Arguments
/// * `service_url` - The URL of the Enigma service
impl EnigmaEncryptionService {
    pub fn new(service_url: String) -> Self {
        let client = match Self::create_tls_client() {
            Ok(client) => client,
            Err(e) => {
                panic!("Warning: Failed to create TLS client: {}", e);
            }
        };

        Self {
            service_url,
            client,
        }
    }

    fn create_tls_client() -> Result<reqwest::Client, Box<dyn std::error::Error>> {
        let cert_and_key = if let Ok(cert) = env::var("CLIENT_CRT") {
            cert.as_bytes().to_vec()
        } else {
            tracing::warn!(
                "failed to read CLIENT_CRT from environment variable, reading from file"
            );
            fs::read("client.crt")?
        };

        let key = if let Ok(key) = env::var("CLIENT_KEY") {
            key.as_bytes().to_vec()
        } else {
            tracing::warn!(
                "failed to read CLIENT_KEY from environment variable, reading from file"
            );
            fs::read("client.key")?
        };

        let mut pem = Vec::new();

        pem.extend_from_slice(&cert_and_key);

        if !cert_and_key.ends_with(b"\n") {
            pem.push(b'\n');
        }
        pem.extend_from_slice(&key);

        let identity = Identity::from_pem(&pem)?;

        let ca_cert = if let Ok(ca_cert) = env::var("CA_CRT") {
            ca_cert.as_bytes().to_vec()
        } else {
            tracing::warn!("failed to read CA_CRT from environment variable, reading from file");
            fs::read("ca.crt")?
        };
        let ca_certificate = Certificate::from_pem(&ca_cert)?;

        let client = reqwest::Client::builder()
            .use_rustls_tls()
            .tls_built_in_root_certs(false)
            .add_root_certificate(ca_certificate)
            .identity(identity)
            .build()
            .map_err(|e| format!("Failed to build reqwest client: {}", e))?;

        Ok(client)
    }

    /// Registers an app with participants and threshold
    ///
    /// # Arguments
    /// * `payload` - RegisterRequest struct containing turbo_da_app_id, participants, and threshold
    ///
    /// # Returns
    /// * `RegisterResponse` - Response containing turbo_da_app_id and participants_added count
    pub async fn register(
        &self,
        payload: RegisterRequest,
    ) -> Result<RegisterResponse, reqwest::Error> {
        let url = format!("{}/v1/register", self.service_url.clone());

        let response = self.client.post(&url).json(&payload).send().await?;

        let response = response.json::<RegisterResponse>().await?;
        Ok(response)
    }

    /// Adds participants to an existing app
    ///
    /// # Arguments
    /// * `payload` - AddParticipantRequest struct containing turbo_da_app_id and participants
    ///
    /// # Returns
    /// * `AddParticipantResponse` - Response containing turbo_da_app_id and participants_added count
    pub async fn add_participant(
        &self,
        payload: AddParticipantRequest,
    ) -> Result<AddParticipantResponse, reqwest::Error> {
        let url = format!("{}/v1/add_participant", self.service_url.clone());

        let response = self.client.post(&url).json(&payload).send().await?;

        let response = response.json::<AddParticipantResponse>().await?;
        Ok(response)
    }

    /// Deletes participants from an existing app
    ///
    /// # Arguments
    /// * `payload` - DeleteParticipantRequest struct containing turbo_da_app_id and participants
    ///
    /// # Returns
    /// * `DeleteParticipantResponse` - Response containing turbo_da_app_id and participants_deleted count
    pub async fn delete_participant(
        &self,
        payload: DeleteParticipantRequest,
    ) -> Result<DeleteParticipantResponse, reqwest::Error> {
        let url = format!("{}/v1/delete_participant", self.service_url.clone());

        let response = self.client.delete(&url).json(&payload).send().await?;

        let response = response.json::<DeleteParticipantResponse>().await?;
        Ok(response)
    }

    /// Encrypts the payload using the Enigma service
    ///
    /// # Arguments
    /// * `payload` - EncryptRequest struct containing app_id and plaintext
    ///
    /// # Returns
    /// * `EncryptResponse` - The encrypted data with signatures and keys
    pub async fn encrypt(
        &self,
        payload: EncryptRequest,
    ) -> Result<EncryptResponse, reqwest::Error> {
        let url = format!("{}/v1/encrypt", self.service_url.clone());

        let response = self.client.post(&url).json(&payload).send().await?;

        let response = response.json::<EncryptResponse>().await?;
        Ok(response)
    }

    /// Creates a decryption request that requires threshold signatures
    ///
    /// # Arguments
    /// * `payload` - DecryptRequest struct containing turbo_da_app_id and ciphertext
    ///
    /// # Returns
    /// * `DecryptRequestResponse` - Response containing request_id, status, and signers list
    pub async fn create_decrypt_request(
        &self,
        payload: DecryptRequest,
    ) -> Result<DecryptRequestResponse, reqwest::Error> {
        let url = format!("{}/v1/create_decrypt_request", self.service_url.clone());

        let response = self.client.post(&url).json(&payload).send().await?;

        let response = response.json::<DecryptRequestResponse>().await?;
        Ok(response)
    }

    /// Gets the status of a decryption request
    ///
    /// # Arguments
    /// * `request_id` - The unique identifier of the decryption request
    ///
    /// # Returns
    /// * `DecryptRequestResponse` - Response containing request status and details
    pub async fn get_decrypt_request(
        &self,
        request_id: &str,
    ) -> Result<DecryptRequestResponse, reqwest::Error> {
        let url = format!(
            "{}/v1/decrypt_request/{}",
            self.service_url.clone(),
            request_id
        );

        let response = self.client.get(&url).send().await?;

        let response = response.json::<DecryptRequestResponse>().await?;
        Ok(response)
    }

    /// Submits a signature for a decryption request
    ///
    /// # Arguments
    /// * `request_id` - The unique identifier of the decryption request
    /// * `payload` - SubmitSignatureRequest struct containing participant_address and signature
    ///
    /// # Returns
    /// * `SubmitSignatureResponse` - Response indicating if threshold is met and decryption status
    pub async fn submit_signature(
        &self,
        request_id: &str,
        payload: SubmitSignatureRequest,
    ) -> Result<SubmitSignatureResponse, reqwest::Error> {
        let url = format!(
            "{}/v1/decrypt_request/{}/signatures",
            self.service_url.clone(),
            request_id
        );

        let response = self.client.post(&url).json(&payload).send().await?;

        let response = response.json::<SubmitSignatureResponse>().await?;
        Ok(response)
    }

    /// Legacy decrypt method - use create_decrypt_request + submit_signature + get_decrypt_request instead
    ///
    /// # Arguments
    /// * `payload` - DecryptRequest struct containing app_id, ciphertext, and ephemeral_pub_key
    ///
    /// # Returns
    /// * `DecryptRequestData` - The decrypted data
    #[deprecated(
        since = "0.2.0",
        note = "Use create_decrypt_request, submit_signature, and get_decrypt_request for threshold-based decryption"
    )]
    pub async fn decrypt(
        &self,
        payload: DecryptRequest,
    ) -> Result<DecryptRequestData, reqwest::Error> {
        let response = self
            .client
            .post(format!("{}/v1/decrypt", self.service_url.clone()))
            .json(&payload)
            .send()
            .await?;

        let response = response.json::<DecryptRequestData>().await?;
        Ok(response)
    }

    /// Formats the encrypt response to the data submission format
    /// | ephemeral_pub_key (constant size 65 bytes) | ciphertext (encrypted DA payload) |
    /// * Here we are assuming that the ephemeral_pub_key is returned in the uncompressed format.
    pub fn format_encrypt_response_to_data_submission(&self, payload: &EncryptResponse) -> Vec<u8> {
        let mut formatted_payload = Vec::new();
        formatted_payload.extend_from_slice(&payload.ephemeral_pub_key);
        formatted_payload.extend_from_slice(&payload.ciphertext);
        formatted_payload
    }
}

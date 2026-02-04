use std::{env, fs};

use reqwest::{Certificate, Client, Identity};
use serde_json::json;

/// Error type for Enigma service operations
#[derive(Debug)]
pub enum EnigmaError {
    /// HTTP/network error from reqwest
    Request(reqwest::Error),
    /// API error returned by Enigma service (non-2xx response)
    Api { status: u16, message: String },
    /// Failed to parse response
    Parse { body: String, error: String },
}

impl std::fmt::Display for EnigmaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EnigmaError::Request(e) => write!(f, "Request error: {}", e),
            EnigmaError::Api { status, message } => write!(f, "API error ({}): {}", status, message),
            EnigmaError::Parse { body, error } => write!(f, "Parse error: {} (body: {})", error, body),
        }
    }
}

impl std::error::Error for EnigmaError {}

impl From<reqwest::Error> for EnigmaError {
    fn from(e: reqwest::Error) -> Self {
        EnigmaError::Request(e)
    }
}

use types::{
    ChangeSignersRequestRecord, CreateChangeSignersRequest, CreateChangeSignersResponse,
    DecryptRequest, DecryptRequestData,
    DecryptRequestResponse, EncryptRequest,
    EncryptResponse, ListChangeSignersQuery, ListChangeSignersResponse, ListDecryptRequestsQuery,
    ListDecryptRequestsResponse, RegisterRequest,
    RegisterResponse, SubmitChangeSignersSignatureRequest, SubmitChangeSignersSignatureResponse,
    SubmitSignatureRequest, SubmitSignatureResponse,
};

use crate::types::{DecryptionRequestRecord, SubmitSignatureRequestEnigma};

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
    ) -> Result<RegisterResponse, EnigmaError> {
        let url = format!("{}/v1/register", self.service_url.clone());

        let response = self.client.post(&url).json(&payload).send().await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma register response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: RegisterResponse = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
    }

    /// Creates a change signers request
    ///
    /// # Arguments
    /// * `payload` - CreateChangeSignersRequest struct containing turbo_da_app_id, new_participants, and new_threshold
    ///
    /// # Returns
    /// * `CreateChangeSignersResponse` - Response containing the created request details
    pub async fn create_change_signers_request(
        &self,
        payload: CreateChangeSignersRequest,
    ) -> Result<CreateChangeSignersResponse, EnigmaError> {
        let url = format!("{}/v1/change_signers/create", self.service_url);

        let response = self.client.post(&url).json(&payload).send().await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma create_change_signers_request response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: CreateChangeSignersResponse = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
    }

    /// Lists change signers requests
    ///
    /// # Arguments
    /// * `query` - ListChangeSignersQuery struct containing turbo_da_app_id and optional filters
    ///
    /// # Returns
    /// * `ListChangeSignersResponse` - Paginated list of change signers requests
    pub async fn list_change_signers(
        &self,
        query: ListChangeSignersQuery,
    ) -> Result<ListChangeSignersResponse, EnigmaError> {
        let url = format!("{}/v1/change_signers/list", self.service_url);

        let mut params = vec![("turbo_da_app_id", query.turbo_da_app_id)];
        if let Some(status) = query.status {
            params.push(("status", status));
        }
        if let Some(offset) = query.offset {
            params.push(("offset", offset.to_string()));
        }
        if let Some(limit) = query.limit {
            params.push(("limit", limit.to_string()));
        }

        let response = self.client.get(&url).query(&params).send().await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma list_change_signers response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: ListChangeSignersResponse = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
    }

    /// Gets a single change signers request
    ///
    /// # Arguments
    /// * `request_id` - The unique identifier of the change signers request
    ///
    /// # Returns
    /// * `ChangeSignersRequestRecord` - The change signers request details
    pub async fn get_change_signers_request(
        &self,
        request_id: &str,
    ) -> Result<ChangeSignersRequestRecord, EnigmaError> {
        let url = format!("{}/v1/change_signers/{}", self.service_url, request_id);

        let response = self.client.get(&url).send().await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma get_change_signers_request response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: ChangeSignersRequestRecord = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
    }

    /// Submits a signature for a change signers request
    ///
    /// # Arguments
    /// * `payload` - SubmitChangeSignersSignatureRequest struct containing request_id, participant_address, and signature
    ///
    /// # Returns
    /// * `SubmitChangeSignersSignatureResponse` - Response indicating if threshold is met and execution status
    pub async fn submit_change_signers_signature(
        &self,
        payload: SubmitChangeSignersSignatureRequest,
    ) -> Result<SubmitChangeSignersSignatureResponse, EnigmaError> {
        let url = format!(
            "{}/v1/change_signers/{}/sign",
            self.service_url, payload.request_id
        );

        let response = self
            .client
            .post(&url)
            .json(&json!({
                "participant_address": payload.participant_address,
                "signature": payload.signature
            }))
            .send()
            .await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma submit_change_signers_signature response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: SubmitChangeSignersSignatureResponse = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
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
    ) -> Result<EncryptResponse, EnigmaError> {
        let url = format!("{}/v1/encrypt", self.service_url.clone());

        let response = self.client.post(&url).json(&payload).send().await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma encrypt response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: EncryptResponse = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
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
        request: DecryptRequest,
        payload: Vec<u8>,
    ) -> Result<DecryptRequestResponse, EnigmaError> {
        let url = format!("{}/v1/create_decrypt_request", self.service_url.clone());

        let response = self
            .client
            .post(&url)
            .json(&json!({"turbo_da_app_id":request.turbo_da_app_id, "ciphertext": payload,"id":request.id}))
            .send()
            .await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma create_decrypt_request response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: DecryptRequestResponse = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
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
    ) -> Result<DecryptionRequestRecord, EnigmaError> {
        let url = format!(
            "{}/v1/decrypt_request/{}",
            self.service_url.clone(),
            request_id
        );

        let response = self.client.get(&url).send().await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma get_decrypt_request response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: DecryptionRequestRecord = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
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
        payload: SubmitSignatureRequest,
    ) -> Result<SubmitSignatureResponse, EnigmaError> {
        let url = format!(
            "{}/v1/decrypt_request/{}/signatures",
            self.service_url.clone(),
            payload.id
        );

        let data = SubmitSignatureRequestEnigma {
            participant_address: payload.participant_address,
            signature: payload.signature,
        };
        let response = self.client.post(&url).json(&data).send().await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma submit_signature response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: SubmitSignatureResponse = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
    }

    /// Lists decryption requests for a given turbo_da_app_id
    ///
    /// # Arguments
    /// * `query` - ListDecryptRequestsQuery struct containing turbo_da_app_id and optional pagination
    ///
    /// # Returns
    /// * `ListDecryptRequestsResponse` - Paginated list of decryption requests
    pub async fn list_decrypt_requests(
        &self,
        query: ListDecryptRequestsQuery,
    ) -> Result<ListDecryptRequestsResponse, EnigmaError> {
        let url = format!("{}/v1/decrypt_requests", self.service_url);

        let mut params = vec![("turbo_da_app_id", query.turbo_da_app_id)];
        if let Some(offset) = query.offset {
            params.push(("offset", offset.to_string()));
        }
        if let Some(limit) = query.limit {
            params.push(("limit", limit.to_string()));
        }

        let response = self.client.get(&url).query(&params).send().await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma list_decrypt_requests response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: ListDecryptRequestsResponse = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
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
    ) -> Result<DecryptRequestData, EnigmaError> {
        let response = self
            .client
            .post(format!("{}/v1/decrypt", self.service_url.clone()))
            .json(&payload)
            .send()
            .await?;

        let status = response.status();
        let body = response.text().await?;

        tracing::info!(%status, %body, "enigma decrypt response");

        if !status.is_success() {
            tracing::error!(%status, %body, "enigma returned error");
            return Err(EnigmaError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let parsed: DecryptRequestData = serde_json::from_str(&body).map_err(|e| {
            EnigmaError::Parse {
                body: body.clone(),
                error: e.to_string(),
            }
        })?;

        Ok(parsed)
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

use std::{env, fs};

use reqwest::{Certificate, Client, Identity};
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
            println!(
                "Warning: Failed to read CLIENT_CRT from environment variable, reading from file"
            );
            fs::read("client.crt")?
        };

        let key = if let Ok(key) = env::var("CLIENT_KEY") {
            key.as_bytes().to_vec()
        } else {
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
            fs::read("ca.crt")?
        };
        let ca_certificate = Certificate::from_pem(&ca_cert)?;

        let client = reqwest::Client::builder()
            .add_root_certificate(ca_certificate)
            .identity(identity)
            .connection_verbose(true)
            .https_only(true)
            .danger_accept_invalid_certs(true) // para rustls
            .max_tls_version(reqwest::tls::Version::TLS_1_2)
            .use_rustls_tls()
            .build()
            .map_err(|e| format!("Failed to build reqwest client: {}", e))?;

        Ok(client)
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
        println!(
            "{}",
            format!("Service URL: {}", self.service_url.clone()).to_string()
        );
        let response = self
            .client
            .post(format!("{}/v1/encrypt", self.service_url.clone()))
            .json(&payload)
            .send()
            .await?;
        println!("{}", format!("Response: {:?}", response).to_string());
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
        let response = self
            .client
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

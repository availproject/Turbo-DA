use alloy_primitives::{Address, Signature};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
pub struct GetQuoteResponse {
    pub quote: String,
    pub event_log: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EncryptRequest {
    #[serde(with = "serde_bytes")]
    pub plaintext: Vec<u8>,
    pub turbo_da_app_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptResponse {
    pub ciphertext: Vec<u8>,
    pub ciphertext_hash: Vec<u8>,
    pub plaintext_hash: Vec<u8>,
    pub signature_ciphertext_hash: Signature,
    pub signature_plaintext_hash: Signature,
    pub address: Address,
    pub ephemeral_pub_key: Vec<u8>,
}

#[derive(Serialize)]
pub struct QuoteResponse {
    pub quote: GetQuoteResponse,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DecryptRequest {
    pub turbo_da_app_id: Uuid,
    pub ciphertext: Vec<u8>,
    pub ephemeral_pub_key: Vec<u8>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptRequestData {
    pub app_id: String,
    pub ciphertext_array: Vec<u8>,
    pub ephemeral_pub_key_array: Vec<u8>,
    pub decrypted_array: Option<Vec<u8>>,
}

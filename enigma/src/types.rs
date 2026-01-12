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

// Register app with participants
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegisterRequest {
    pub turbo_da_app_id: String,
    pub participants: Vec<String>,
    pub threshold: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterResponse {
    pub turbo_da_app_id: String,
    pub participants_added: i32,
}

// Add participants
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AddParticipantRequest {
    pub turbo_da_app_id: String,
    pub participants: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddParticipantResponse {
    pub turbo_da_app_id: String,
    pub participants_added: i32,
}

// Delete participants
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeleteParticipantRequest {
    pub turbo_da_app_id: String,
    pub participants: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteParticipantResponse {
    pub turbo_da_app_id: String,
    pub participants_deleted: i32,
}

// Decryption request types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DecryptRequest {
    pub turbo_da_app_id: Uuid,
    pub ciphertext: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DecryptRequestResponse {
    pub request_id: String,
    pub turbo_da_app_id: String,
    pub status: String,
    pub signers: Vec<String>,
    pub created_at: i64,
}

// Submit signature
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubmitSignatureRequest {
    pub participant_address: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitSignatureResponse {
    pub request_id: String,
    pub status: String,
    pub signatures_submitted: usize,
    pub threshold: i32,
    pub ready_to_decrypt: bool,
    pub tee_attestion: Option<String>,
}

// Legacy types - kept for backwards compatibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptRequestData {
    pub app_id: String,
    pub ciphertext_array: Vec<u8>,
    pub ephemeral_pub_key_array: Vec<u8>,
    pub decrypted_array: Option<Vec<u8>>,
}

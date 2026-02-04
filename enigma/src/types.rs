use alloy_primitives::{Address, Signature};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
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

// Decryption request types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DecryptRequest {
    pub turbo_da_app_id: Uuid,
    pub id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DecryptRequestResponse {
    pub id: String,
    pub turbo_da_app_id: String,
    pub status: String,
    pub signers: Vec<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptionRequestRecord {
    pub id: String,
    pub turbo_da_app_id: String,
    pub ciphertext: Vec<u8>,
    pub submitted_signatures: String,
    pub decrypted_data: Option<Vec<u8>>,
    pub status: String,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

// Submit signature
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubmitSignatureRequest {
    pub id: Uuid,
    pub participant_address: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitSignatureRequestEnigma {
    pub participant_address: String,
    pub signature: String,
}

#[derive(Serialize, Deserialize)]
pub struct SubmitSignatureResponse {
    pub id: String,
    pub status: String,
    pub signatures_submitted: usize,
    pub threshold: i64,
    pub ready_to_decrypt: bool,
    pub tee_attestion: Option<GetQuoteResponse>,
}

// Legacy types - kept for backwards compatibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptRequestData {
    pub app_id: String,
    pub ciphertext_array: Vec<u8>,
    pub ephemeral_pub_key_array: Vec<u8>,
    pub decrypted_array: Option<Vec<u8>>,
}

// List decrypt requests
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListDecryptRequestsQuery {
    pub turbo_da_app_id: String,
    pub offset: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DecryptionRequestListWithThreshold {
    pub id: String,
    pub turbo_da_app_id: String,
    pub submitted_signatures: String,
    pub status: String,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub threshold: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListDecryptRequestsResponse {
    pub items: Vec<DecryptionRequestListWithThreshold>,
    pub total: u32,
    pub offset: u32,
    pub limit: u32,
}

// Change Signers Request types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateChangeSignersRequest {
    pub turbo_da_app_id: String,
    pub new_participants: Vec<String>,
    pub new_threshold: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateChangeSignersResponse {
    pub id: String,
    pub turbo_da_app_id: String,
    pub status: String,
    pub signers: Vec<String>,
    pub new_participants: Vec<String>,
    pub new_threshold: i32,
    pub created_at: i64,
}

// List Change Signers Query
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ListChangeSignersQuery {
    pub turbo_da_app_id: String,
    pub status: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

// Change Signers Request Record
#[derive(Debug, Serialize, Deserialize)]
pub struct ChangeSignersRequestRecord {
    pub id: String,
    pub turbo_da_app_id: String,
    pub new_participants: Vec<String>,
    pub new_threshold: i32,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListChangeSignersResponse {
    pub items: Vec<ChangeSignersRequestRecord>,
    pub total: u32,
    pub offset: u32,
    pub limit: u32,
}

// Get Single Change Signers Request
#[derive(Debug, Deserialize)]
pub struct GetChangeSignersRequest {
    pub request_id: String,
}

// Submit Change Signers Signature
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubmitChangeSignersSignatureRequest {
    pub request_id: String,
    pub participant_address: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitChangeSignersSignatureResponse {
    pub id: String,
    pub status: String,
    pub signatures_submitted: i32,
    pub threshold: i32,
    pub ready_to_execute: bool,
    pub tee_attestion: Option<GetQuoteResponse>,
}

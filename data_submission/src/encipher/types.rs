use alloy_primitives::{Address, Signature};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EncryptRequest {
    pub app_id: u32,
    #[serde(with = "serde_bytes")]
    pub plaintext: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EncryptResponse {
    pub ciphertext: Vec<u8>,
    pub signature: Signature,
    pub address: Address,
    pub ephemeral_pub_key: Vec<u8>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DecryptRequest {
    pub app_id: u32,
    pub ciphertext: Vec<u8>,
    pub ephemeral_pub_key: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DecryptResponse {
    pub plaintext: Vec<u8>,
}

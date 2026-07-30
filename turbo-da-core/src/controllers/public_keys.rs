use crate::utils::{get_connection, is_valid_hex_address, retrieve_user_id_from_jwt};
use actix_web::{delete, get, post, web, HttpRequest, HttpResponse, Responder};
use alloy_primitives::Signature;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::str::FromStr;
use uuid::Uuid;

/// How long a signer challenge stays valid, in seconds.
const CHALLENGE_TTL_SECS: i64 = 600;

#[derive(Deserialize, Serialize)]
pub struct AddPublicKeyRequest {
    pub public_address: String,
}

#[derive(Deserialize, Serialize)]
pub struct DeletePublicKeyRequest {
    pub public_address: String,
}

#[derive(Deserialize, Serialize)]
pub struct ChallengeRequest {
    pub public_address: String,
}

#[derive(Deserialize, Serialize)]
pub struct VerifyRequest {
    pub public_address: String,
    pub signature: String,
}

/// Builds the exact text a wallet is asked to sign.
///
/// Both the challenge and the verification path go through here: the recovered
/// address only matches if the bytes are identical on both sides.
fn challenge_message(nonce: &Uuid, user_id: &str) -> String {
    format!("TurboDA signer verification\nnonce: {nonce}\nuser: {user_id}")
}

/// Issue a nonce for the caller to sign, proving control of an address
///
/// # Description
/// Returns the exact message the wallet must sign with `personal_sign`. Only
/// one challenge is live per address at a time; requesting a new one replaces
/// any outstanding challenge.
///
/// # Route
/// `POST /v1/user/public_keys/challenge`
///
/// # Request Body
/// ```json
/// {
///   "public_address": "0x..."
/// }
/// ```
///
/// # Returns
/// * 200 OK with the message to sign and its lifetime in seconds
/// * 400 Bad Request if the address is not a 0x prefixed 40 character hex string
/// * 500 Internal Server Error if the challenge could not be stored
#[tracing::instrument(
    skip(payload, http_request, injected_dependency),
    fields(endpoint = "public_keys_challenge")
)]
#[post("/public_keys/challenge")]
pub async fn create_signer_challenge(
    payload: web::Json<ChallengeRequest>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user_id = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User ID not retrieved",
            }))
        }
    };

    if !is_valid_hex_address(&payload.public_address) {
        return HttpResponse::BadRequest().json(json!({
            "state": "ERROR",
            "error": "invalid ethereum address",
        }));
    }

    let address = payload.public_address.to_lowercase();

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let nonce = Uuid::new_v4();

    match db::controllers::signer_challenges::upsert_challenge(
        &mut connection,
        &user_id,
        &address,
        nonce,
        CHALLENGE_TTL_SECS,
    )
    .await
    {
        Ok(challenge) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "challenge created successfully",
            "data": {
                "message": challenge_message(&challenge.nonce, &user_id),
                "expires_in": CHALLENGE_TTL_SECS,
            }
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": format!("Failed to create challenge: {}", e),
        })),
    }
}

/// Verify a signed challenge and mark the address as a verified signer
///
/// # Description
/// The challenge is consumed whether or not verification succeeds, so a failed
/// attempt requires requesting a fresh nonce. An address that is not registered
/// yet is added on successful verification.
///
/// # Route
/// `POST /v1/user/public_keys/verify`
///
/// # Request Body
/// ```json
/// {
///   "public_address": "0x...",
///   "signature": "0x..."
/// }
/// ```
///
/// # Returns
/// * 200 OK with the verified public key
/// * 400 Bad Request if the address is malformed or no live challenge exists
/// * 401 Unauthorized if the signature does not recover to the given address
/// * 500 Internal Server Error if the update fails
#[tracing::instrument(
    skip(payload, http_request, injected_dependency),
    fields(endpoint = "public_keys_verify")
)]
#[post("/public_keys/verify")]
pub async fn verify_signer_challenge(
    payload: web::Json<VerifyRequest>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user_id = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User ID not retrieved",
            }))
        }
    };

    if !is_valid_hex_address(&payload.public_address) {
        return HttpResponse::BadRequest().json(json!({
            "state": "ERROR",
            "error": "invalid ethereum address",
        }));
    }

    let address = payload.public_address.to_lowercase();

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let challenge = match db::controllers::signer_challenges::take_valid_challenge(
        &mut connection,
        &user_id,
        &address,
    )
    .await
    {
        Ok(Some(challenge)) => challenge,
        Ok(None) => {
            return HttpResponse::BadRequest().json(json!({
                "state": "ERROR",
                "error": "no active challenge or challenge expired",
            }))
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": format!("Failed to load challenge: {}", e),
            }))
        }
    };

    let message = challenge_message(&challenge.nonce, &user_id);

    let raw_signature = payload.signature.trim();
    let raw_signature = raw_signature.strip_prefix("0x").unwrap_or(raw_signature);

    let signature = match Signature::from_str(raw_signature) {
        Ok(signature) => signature,
        Err(e) => {
            return HttpResponse::BadRequest().json(json!({
                "state": "ERROR",
                "error": format!("invalid signature: {}", e),
            }))
        }
    };

    let recovered = match signature.recover_address_from_msg(message.as_bytes()) {
        Ok(recovered) => recovered,
        Err(e) => {
            return HttpResponse::Unauthorized().json(json!({
                "state": "ERROR",
                "error": format!("could not recover signer: {}", e),
            }))
        }
    };

    if !recovered.to_string().eq_ignore_ascii_case(&address) {
        return HttpResponse::Unauthorized().json(json!({
            "state": "ERROR",
            "error": "signature does not match the provided address",
        }));
    }

    let existing = match db::controllers::public_keys::get_public_keys_by_user(
        &mut connection,
        &user_id,
    )
    .await
    {
        Ok(keys) => keys,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": format!("Failed to retrieve public keys: {}", e),
            }))
        }
    };

    // Registered keys keep whatever casing they were stored with, so the stored
    // spelling is what `mark_verified` has to filter on.
    let stored_address = existing
        .iter()
        .find(|key| key.public_address.eq_ignore_ascii_case(&address))
        .map(|key| key.public_address.clone());

    let stored_address = match stored_address {
        Some(stored) => stored,
        None => {
            match db::controllers::public_keys::add_public_key(&mut connection, &user_id, &address)
                .await
            {
                Ok(Some(key)) => key.public_address,
                Ok(None) => address.clone(),
                Err(e) => {
                    return HttpResponse::InternalServerError().json(json!({
                        "state": "ERROR",
                        "error": format!("Failed to add public key: {}", e),
                    }))
                }
            }
        }
    };

    if let Err(e) =
        db::controllers::signer_challenges::mark_verified(&mut connection, &stored_address).await
    {
        return HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": format!("Failed to mark key as verified: {}", e),
        }));
    }

    match db::controllers::public_keys::get_public_keys_by_user(&mut connection, &user_id).await {
        Ok(keys) => {
            let updated = keys
                .into_iter()
                .find(|key| key.public_address.eq_ignore_ascii_case(&stored_address));

            HttpResponse::Ok().json(json!({
                "state": "SUCCESS",
                "message": "Public key verified successfully",
                "data": updated,
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": format!("Failed to retrieve public keys: {}", e),
        })),
    }
}

/// Add a public key for the authenticated user
///
/// # Route
/// `POST /v1/user/public_keys`
///
/// # Request Body
/// ```json
/// {
///   "public_address": "0x..."
/// }
/// ```
///
/// # Returns
/// * 200 OK with the created public key
/// * 409 Conflict if public key already exists
/// * 500 Internal Server Error if operation fails
#[post("/public_keys")]
pub async fn add_public_key(
    payload: web::Json<AddPublicKeyRequest>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user_id = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User ID not retrieved",
            }))
        }
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let result = db::controllers::public_keys::add_public_key(
        &mut connection,
        &user_id,
        &payload.public_address,
    )
    .await;

    match result {
        Ok(Some(public_key)) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "Public key added successfully",
            "data": public_key,
        })),
        Ok(None) => HttpResponse::Conflict().json(json!({
            "state": "ERROR",
            "error": "Public key already exists",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": format!("Failed to add public key: {}", e),
        })),
    }
}

/// Get all public keys for the authenticated user
///
/// # Route
/// `GET /v1/user/public_keys`
///
/// # Returns
/// * 200 OK with list of public keys
/// * 500 Internal Server Error if operation fails
#[get("/public_keys")]
pub async fn get_public_keys(
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user_id = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User ID not retrieved",
            }))
        }
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let result =
        db::controllers::public_keys::get_public_keys_by_user(&mut connection, &user_id).await;

    match result {
        Ok(public_keys) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "Public keys retrieved successfully",
            "data": public_keys,
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": format!("Failed to retrieve public keys: {}", e),
        })),
    }
}

/// Delete a public key for the authenticated user
///
/// # Route
/// `DELETE /v1/user/public_keys`
///
/// # Request Body
/// ```json
/// {
///   "public_address": "0x..."
/// }
/// ```
///
/// # Returns
/// * 200 OK if deletion succeeds
/// * 404 Not Found if public key doesn't exist
/// * 500 Internal Server Error if operation fails
#[delete("/public_keys")]
pub async fn delete_public_key(
    payload: web::Json<DeletePublicKeyRequest>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user_id = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User ID not retrieved",
            }))
        }
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let result = db::controllers::public_keys::delete_public_key(
        &mut connection,
        &user_id,
        &payload.public_address,
    )
    .await;

    match result {
        Ok(count) if count > 0 => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "Public key deleted successfully",
        })),
        Ok(_) => HttpResponse::NotFound().json(json!({
            "state": "ERROR",
            "error": "Public key not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": format!("Failed to delete public key: {}", e),
        })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy::signers::{local::PrivateKeySigner, SignerSync};

    /// The wallet signs with `personal_sign`, so recovery has to apply the same
    /// EIP-191 prefix; this pins that round trip across the two alloy versions
    /// in the tree (the signer's, and the one used for recovery here).
    #[test]
    fn recovers_the_signer_of_a_personal_sign_challenge() {
        let signer = PrivateKeySigner::random();
        let nonce = Uuid::new_v4();
        let message = challenge_message(&nonce, "user@example.com");

        let signed = signer.sign_message_sync(message.as_bytes()).unwrap();
        let encoded = format!("0x{}", hex::encode(signed.as_bytes()));

        let bare = encoded.strip_prefix("0x").unwrap();
        let recovered = Signature::from_str(bare)
            .unwrap()
            .recover_address_from_msg(message.as_bytes())
            .unwrap();

        assert!(recovered
            .to_string()
            .eq_ignore_ascii_case(&signer.address().to_string()));
    }

    #[test]
    fn rejects_addresses_that_are_not_forty_hex_characters() {
        assert!(is_valid_hex_address(
            "0x0000000000000000000000000000000000000001"
        ));
        assert!(!is_valid_hex_address("0x01"));
        assert!(!is_valid_hex_address(
            "0000000000000000000000000000000000000001"
        ));
    }
}

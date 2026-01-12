use actix_web::{delete, get, post, web, HttpResponse};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use enigma::{
    types::{
        AddParticipantRequest, DeleteParticipantRequest, DecryptRequest, RegisterRequest,
        SubmitSignatureRequest,
    },
    EnigmaEncryptionService,
};
use serde_json::json;

/// Register a new application with participants for threshold encryption
///
/// # Description
/// This endpoint registers a new turbo_da_app_id with a list of participants
/// and a threshold value for multi-signature decryption.
///
/// # Route
/// `POST /v1/enigma/register`
///
/// # Headers
/// * `Authorization: Bearer <token>` - Bearer token for authentication
/// * `Content-Type: application/json`
///
/// # Request Body
/// ```json
/// {
///   "turbo_da_app_id": "app-uuid",
///   "participants": ["0xAddress1", "0xAddress2", "0xAddress3"],
///   "threshold": 2
/// }
/// ```
///
/// # Returns
/// JSON response with registration status and participant count
///
/// # Example Request
/// ```bash
/// curl -X POST "https://api.example.com/v1/enigma/register" \
///      -H "Authorization: Bearer YOUR_TOKEN" \
///      -H "Content-Type: application/json" \
///      -d '{"turbo_da_app_id":"app-123","participants":["0xAddr1","0xAddr2"],"threshold":2}'
/// ```
#[tracing::instrument(
    skip(enigma),
    fields(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        threshold = request.threshold,
        endpoint = "enigma_register"
    )
)]
#[post("/enigma/register")]
pub async fn register(
    request: web::Json<RegisterRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
) -> HttpResponse {
    tracing::info!(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        "registering app with participants"
    );

    match enigma.register(request.into_inner()).await {
        Ok(response) => {
            tracing::info!(
                turbo_da_app_id = %response.turbo_da_app_id,
                participants_added = response.participants_added,
                "successfully registered app"
            );
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to register app");
            HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to register app: {}", e)
            }))
        }
    }
}

/// Add participants to an existing application
///
/// # Description
/// Adds new participants to an existing turbo_da_app_id that can participate
/// in threshold decryption.
///
/// # Route
/// `POST /v1/enigma/add_participant`
///
/// # Headers
/// * `Authorization: Bearer <token>` - Bearer token for authentication
/// * `Content-Type: application/json`
///
/// # Request Body
/// ```json
/// {
///   "turbo_da_app_id": "app-uuid",
///   "participants": ["0xAddress4", "0xAddress5"]
/// }
/// ```
#[tracing::instrument(
    skip(enigma),
    fields(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        endpoint = "enigma_add_participant"
    )
)]
#[post("/enigma/add_participant")]
pub async fn add_participant(
    request: web::Json<AddParticipantRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
) -> HttpResponse {
    tracing::info!(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        "adding participants to app"
    );

    match enigma.add_participant(request.into_inner()).await {
        Ok(response) => {
            tracing::info!(
                turbo_da_app_id = %response.turbo_da_app_id,
                participants_added = response.participants_added,
                "successfully added participants"
            );
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to add participants");
            HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to add participants: {}", e)
            }))
        }
    }
}

/// Remove participants from an existing application
///
/// # Description
/// Removes participants from an existing turbo_da_app_id.
///
/// # Route
/// `DELETE /v1/enigma/delete_participant`
///
/// # Headers
/// * `Authorization: Bearer <token>` - Bearer token for authentication
/// * `Content-Type: application/json`
///
/// # Request Body
/// ```json
/// {
///   "turbo_da_app_id": "app-uuid",
///   "participants": ["0xAddress1", "0xAddress2"]
/// }
/// ```
#[tracing::instrument(
    skip(enigma),
    fields(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        endpoint = "enigma_delete_participant"
    )
)]
#[delete("/enigma/delete_participant")]
pub async fn delete_participant(
    request: web::Json<DeleteParticipantRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
) -> HttpResponse {
    tracing::info!(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        "deleting participants from app"
    );

    match enigma.delete_participant(request.into_inner()).await {
        Ok(response) => {
            tracing::info!(
                turbo_da_app_id = %response.turbo_da_app_id,
                participants_deleted = response.participants_deleted,
                "successfully deleted participants"
            );
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to delete participants");
            HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to delete participants: {}", e)
            }))
        }
    }
}

/// Create a new decryption request
///
/// # Description
/// Creates a threshold-based decryption request for encrypted data.
/// Returns a request_id that can be used to poll for status and submit signatures.
///
/// # Route
/// `POST /v1/enigma/create_decrypt_request`
///
/// # Headers
/// * `Authorization: Bearer <token>` - Bearer token for authentication
/// * `Content-Type: application/json`
///
/// # Request Body
/// ```json
/// {
///   "turbo_da_app_id": "app-uuid",
///   "ciphertext": [1, 2, 3, ...]
/// }
/// ```
///
/// # Returns
/// JSON response with request_id, signers list, and status
#[tracing::instrument(
    skip(enigma),
    fields(
        turbo_da_app_id = %request.turbo_da_app_id,
        ciphertext_length = request.ciphertext.len(),
        endpoint = "enigma_create_decrypt_request"
    )
)]
#[post("/enigma/create_decrypt_request")]
pub async fn create_decrypt_request(
    request: web::Json<DecryptRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
) -> HttpResponse {
    tracing::info!(
        turbo_da_app_id = %request.turbo_da_app_id,
        ciphertext_length = request.ciphertext.len(),
        "creating decrypt request"
    );

    match enigma.create_decrypt_request(request.into_inner()).await {
        Ok(response) => {
            tracing::info!(
                request_id = %response.request_id,
                turbo_da_app_id = %response.turbo_da_app_id,
                signer_count = response.signers.len(),
                "successfully created decrypt request"
            );
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to create decrypt request");
            HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to create decrypt request: {}", e)
            }))
        }
    }
}

/// Get the status of a decryption request
///
/// # Description
/// Retrieves the current status of a decryption request, including whether
/// the threshold has been met and the plaintext if decryption is complete.
///
/// # Route
/// `GET /v1/enigma/decrypt_request/{request_id}`
///
/// # Headers
/// * `Authorization: Bearer <token>` - Bearer token for authentication
///
/// # Path Parameters
/// * `request_id` - The UUID of the decryption request
///
/// # Returns
/// JSON response with request status, signers, and plaintext (if completed)
#[tracing::instrument(
    skip(enigma),
    fields(
        request_id = %request_id,
        endpoint = "enigma_get_decrypt_request"
    )
)]
#[get("/enigma/decrypt_request/{request_id}")]
pub async fn get_decrypt_request(
    request_id: web::Path<String>,
    enigma: web::Data<EnigmaEncryptionService>,
) -> HttpResponse {
    tracing::info!(
        request_id = %request_id,
        "fetching decrypt request status"
    );

    match enigma.get_decrypt_request(request_id.into_inner()).await {
        Ok(response) => {
            tracing::info!(
                request_id = %response.request_id,
                status = %response.status,
                "successfully fetched decrypt request"
            );
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch decrypt request");
            if e.to_string().contains("404") {
                HttpResponse::NotFound().json(json!({
                    "error": "Decryption request not found"
                }))
            } else {
                HttpResponse::InternalServerError().json(json!({
                    "error": format!("Failed to fetch decrypt request: {}", e)
                }))
            }
        }
    }
}

/// Submit a participant's signature for a decryption request
///
/// # Description
/// Allows a registered participant to submit their signature for a pending
/// decryption request. When the threshold is met, decryption is performed automatically.
///
/// # Route
/// `POST /v1/enigma/decrypt_request/{request_id}/signatures`
///
/// # Headers
/// * `Authorization: Bearer <token>` - Bearer token for authentication
/// * `Content-Type: application/json`
///
/// # Path Parameters
/// * `request_id` - The UUID of the decryption request
///
/// # Request Body
/// ```json
/// {
///   "participant_address": "0xAddress1",
///   "signature": "0x..."
/// }
/// ```
///
/// # Returns
/// JSON response with signature submission status and decryption result if threshold met
#[tracing::instrument(
    skip(enigma, request),
    fields(
        request_id = %request_id,
        participant_address = %request.participant_address,
        endpoint = "enigma_submit_signature"
    )
)]
#[post("/enigma/decrypt_request/{request_id}/signatures")]
pub async fn submit_signature(
    request_id: web::Path<String>,
    request: web::Json<SubmitSignatureRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
) -> HttpResponse {
    tracing::info!(
        request_id = %request_id,
        participant = %request.participant_address,
        "submitting signature"
    );

    match enigma
        .submit_signature(request_id.into_inner(), request.into_inner())
        .await
    {
        Ok(response) => {
            tracing::info!(
                request_id = %response.request_id,
                status = %response.status,
                signatures_submitted = response.signatures_submitted,
                ready_to_decrypt = response.ready_to_decrypt,
                "successfully submitted signature"
            );
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to submit signature");
            if e.to_string().contains("404") {
                HttpResponse::NotFound().json(json!({
                    "error": "Decryption request not found"
                }))
            } else if e.to_string().contains("not authorized") {
                HttpResponse::Forbidden().json(json!({
                    "error": "Participant not authorized for this request"
                }))
            } else {
                HttpResponse::InternalServerError().json(json!({
                    "error": format!("Failed to submit signature: {}", e)
                }))
            }
        }
    }
}

use std::sync::Arc;

use actix_web::{delete, get, post, web, HttpResponse};
use avail_rust::H256;
use avail_utils::retrieve_data::retrieve_data;
use db::controllers::customer_expenditure::get_customer_expenditure_by_submission_id;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use enigma::{
    types::{
        AddParticipantRequest, DecryptRequest, DeleteParticipantRequest, ListDecryptRequestsQuery,
        RegisterRequest, SubmitSignatureRequest,
    },
    EnigmaEncryptionService, EnigmaError,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::utils::get_connection;
use crate::{config::AppConfig, utils::generate_avail_sdk};

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
    skip(enigma, pool),
    fields(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        threshold = request.threshold,
        endpoint = "enigma_register"
    )
)]
#[post("/register")]
pub async fn register(
    request: web::Json<RegisterRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
    pool: web::Data<Pool<AsyncPgConnection>>,
) -> HttpResponse {
    tracing::info!(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        "registering app with participants"
    );

    let mut connection = match get_connection(&pool).await {
        Ok(conn) => conn,
        Err(e) => return e,
    };

    match enigma.register(request.clone()).await {
        Ok(response) => {
            tracing::info!(
                turbo_da_app_id = %response.turbo_da_app_id,
                participants_added = response.participants_added,
                "successfully registered app"
            );
            if let Ok(app_id) = Uuid::parse_str(&request.turbo_da_app_id) {
                if !request.participants.is_empty() {
                    if let Err(e) = db::controllers::mpc_participants::add_participants(
                        &mut connection,
                        &app_id,
                        request.participants.clone(),
                    )
                    .await
                    {
                        tracing::error!(error = %e, "failed to add participants to db");
                    }
                }
            }
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
    skip(enigma, pool),
    fields(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        endpoint = "enigma_add_participant"
    )
)]
#[post("/add_participant")]
pub async fn add_participant(
    request: web::Json<AddParticipantRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
    pool: web::Data<Pool<AsyncPgConnection>>,
) -> HttpResponse {
    tracing::info!(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        "adding participants to app"
    );

    let mut connection = match get_connection(&pool).await {
        Ok(conn) => conn,
        Err(e) => return e,
    };

    match enigma.add_participant(request.clone()).await {
        Ok(response) => {
            tracing::info!(
                turbo_da_app_id = %response.turbo_da_app_id,
                participants_added = response.participants_added,
                "successfully added participants"
            );
            if let Ok(app_id) = Uuid::parse_str(&request.turbo_da_app_id) {
                if let Err(e) = db::controllers::mpc_participants::add_participants(
                    &mut connection,
                    &app_id,
                    request.participants.clone(),
                )
                .await
                {
                    tracing::error!(error = %e, "failed to add participants to db");
                }
            }
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
    skip(enigma, pool),
    fields(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        endpoint = "enigma_delete_participant"
    )
)]
#[delete("/delete_participant")]
pub async fn delete_participant(
    request: web::Json<DeleteParticipantRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
    pool: web::Data<Pool<AsyncPgConnection>>,
) -> HttpResponse {
    tracing::info!(
        turbo_da_app_id = %request.turbo_da_app_id,
        participant_count = request.participants.len(),
        "deleting participants from app"
    );

    let mut connection = match get_connection(&pool).await {
        Ok(conn) => conn,
        Err(e) => return e,
    };

    match enigma.delete_participant(request.clone()).await {
        Ok(response) => {
            tracing::info!(
                turbo_da_app_id = %response.turbo_da_app_id,
                participants_deleted = response.participants_deleted,
                "successfully deleted participants"
            );
            if let Ok(app_id) = Uuid::parse_str(&request.turbo_da_app_id) {
                if let Err(e) = db::controllers::mpc_participants::delete_participants(
                    &mut connection,
                    &app_id,
                    request.participants.clone(),
                )
                .await
                {
                    tracing::error!(error = %e, "failed to delete participants from db");
                }
            }
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
    skip(enigma, pool),
    fields(
        turbo_da_app_id = %request.turbo_da_app_id,
        id = %request.id,
        endpoint = "enigma_create_decrypt_request"
    )
)]
#[post("/create_decrypt_request")]
pub async fn create_decrypt_request(
    app_config: web::Data<AppConfig>,
    request: web::Json<DecryptRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
    pool: web::Data<Pool<AsyncPgConnection>>,
) -> HttpResponse {
    let mut connection = match get_connection(&pool).await {
        Ok(conn) => conn,
        Err(e) => return e,
    };

    match get_customer_expenditure_by_submission_id(&mut connection, request.id).await {
        Ok(sub) => {
            tracing::debug!(
                id = %request.id,
                "found expenditure for submission"
            );
            if sub.payload.is_some() {
                let pre_image = sub.payload.unwrap();
                match enigma
                    .create_decrypt_request(request.into_inner(), pre_image)
                    .await
                {
                    Ok(response) => {
                        tracing::info!(
                            id = %response.id,
                            turbo_da_app_id = %response.turbo_da_app_id,
                            signer_count = response.signers.len(),
                            "successfully created decrypt request"
                        );
                        return HttpResponse::Ok().json(response);
                    }
                    Err(e) => {
                        tracing::error!(error = %e, "failed to create decrypt request");
                        return HttpResponse::InternalServerError().json(json!({
                            "error": format!("Failed to create decrypt request: {}", e)
                        }));
                    }
                }
            }

            if sub.extrinsic_index.is_none() || sub.block_hash.is_none() {
                return HttpResponse::Accepted().json(json!({
                    "error": "Transaction not finalised yet",
                    "message": "Customer expenditure found but the transaction hasn't been finalised yet. Please try again later."
                }));
            }
            let sdk = generate_avail_sdk(&Arc::new(app_config.avail_rpc_endpoint.clone())).await;
            let b_hash = match hex_string_to_fixed_bytes(sub.block_hash.unwrap().as_str()) {
                Ok(hash) => hash,
                Err(e) => {
                    tracing::error!(error = %e, "failed to parse block hash");
                    return HttpResponse::BadRequest().json(json!({
                        "error": format!("Invalid block hash: {}", e)
                    }));
                }
            };

            match retrieve_data(sdk, H256::from(b_hash), sub.extrinsic_index.unwrap() as u32).await
            {
                Ok(pre_image) => {
                    match enigma
                        .create_decrypt_request(request.into_inner(), pre_image)
                        .await
                    {
                        Ok(response) => {
                            tracing::info!(
                                id = %response.id,
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
                Err(e) => {
                    tracing::error!(error = ?e, "failed to retrieve data from Avail");
                    HttpResponse::InternalServerError().json(json!({
                        "error": format!("Failed to retrieve data from Avail: {:?}", e)
                    }))
                }
            }
        }
        Err(e) => {
            tracing::error!(error = ?e, id = %request.id, "failed to get customer expenditure");
            HttpResponse::NotFound().json(json!({
                "error": format!("Customer expenditure not found for id: {}", request.id)
            }))
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
struct GetDecryptRequest {
    pub submission_id: Uuid
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
        submission_id = %payload.submission_id,
        endpoint = "enigma_get_decrypt_request"
    )
)]
#[get("/get_decrypt_request")]
pub async fn get_decrypt_request(
    payload: web::Query<GetDecryptRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
) -> HttpResponse {
    tracing::info!(
        submission_id = %payload.submission_id,
        "fetching decrypt request status"
    );

    match enigma
        .get_decrypt_request(payload.submission_id.to_string().as_str())
        .await
    {
        Ok(response) => {
            tracing::info!(
                request_id = %response.id,
                status = %response.status,
                "successfully fetched decrypt request"
            );
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch decrypt request");
            match &e {
                EnigmaError::Api { status, message } => {
                    if *status == 404 {
                        HttpResponse::NotFound().json(json!({
                            "error": "Decryption request not found"
                        }))
                    } else {
                        HttpResponse::BadRequest().json(json!({
                            "error": message
                        }))
                    }
                }
                _ => HttpResponse::InternalServerError().json(json!({
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
/// `POST /v1/enigma/submit_signature`
///
/// # Headers
/// * `Authorization: Bearer <token>` - Bearer token for authentication
/// * `Content-Type: application/json`
///
/// # Request Body
/// ```json
/// {
///   "request_id": "uuid",
///   "participant_address": "0xAddress1",
///   "signature": "0x..."
/// }
/// ```
///
/// # Returns
/// JSON response with signature submission status and decryption result if threshold met
#[tracing::instrument(
    skip(enigma),
    fields(
        id = %request.id,
        participant_address = %request.participant_address,
        endpoint = "enigma_submit_signature"
    )
)]
#[post("/submit_signature")]
pub async fn submit_signature(
    request: web::Json<SubmitSignatureRequest>,
    enigma: web::Data<EnigmaEncryptionService>,
) -> HttpResponse {
    tracing::info!(
        id = %request.id,
        participant = %request.participant_address,
        "submitting signature"
    );

    match enigma.submit_signature(request.into_inner()).await {
        Ok(response) => {
            tracing::info!(
                id = %response.id,
                status = %response.status,
                signatures_submitted = response.signatures_submitted,
                ready_to_decrypt = response.ready_to_decrypt,
                "successfully submitted signature"
            );
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to submit signature");
            match &e {
                EnigmaError::Api { status, message } => {
                    if message.contains("already submitted") {
                        HttpResponse::Conflict().json(json!({
                            "error": "Signature already submitted by this participant"
                        }))
                    } else if *status == 404 {
                        HttpResponse::NotFound().json(json!({
                            "error": "Decryption request not found"
                        }))
                    } else if *status == 403 || message.contains("not authorized") {
                        HttpResponse::Forbidden().json(json!({
                            "error": "Participant not authorized for this request"
                        }))
                    } else {
                        HttpResponse::BadRequest().json(json!({
                            "error": message
                        }))
                    }
                }
                _ => HttpResponse::InternalServerError().json(json!({
                    "error": format!("Failed to submit signature to TEE: {}", e)
                }))
            }
        }
    }
}

/// List decryption requests for an application
///
/// # Description
/// Lists all decryption requests for a given turbo_da_app_id with pagination support.
///
/// # Route
/// `GET /v1/enigma/decrypt_requests`
///
/// # Headers
/// * `Authorization: Bearer <token>` - Bearer token for authentication
///
/// # Query Parameters
/// * `turbo_da_app_id` - The UUID of the application
/// * `offset` - Optional pagination offset (default: 0)
/// * `limit` - Optional pagination limit (default: 10)
///
/// # Returns
/// JSON response with paginated list of decryption requests
#[tracing::instrument(
    skip(enigma),
    fields(
        turbo_da_app_id = %query.turbo_da_app_id,
        offset = ?query.offset,
        limit = ?query.limit,
        endpoint = "enigma_list_decrypt_requests"
    )
)]
#[get("/decrypt_requests")]
pub async fn list_decrypt_requests(
    query: web::Query<ListDecryptRequestsQuery>,
    enigma: web::Data<EnigmaEncryptionService>,
) -> HttpResponse {
    tracing::info!(
        turbo_da_app_id = %query.turbo_da_app_id,
        offset = ?query.offset,
        limit = ?query.limit,
        "listing decrypt requests"
    );

    match enigma.list_decrypt_requests(query.into_inner()).await {
        Ok(response) => {
            tracing::info!(
                total = response.total,
                items_count = response.items.len(),
                "successfully listed decrypt requests"
            );
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to list decrypt requests");
            match &e {
                EnigmaError::Api { status, message } => {
                    if *status == 404 {
                        HttpResponse::NotFound().json(json!({
                            "error": "Application not found"
                        }))
                    } else {
                        HttpResponse::BadRequest().json(json!({
                            "error": message
                        }))
                    }
                }
                _ => HttpResponse::InternalServerError().json(json!({
                    "error": format!("Failed to list decrypt requests: {}", e)
                }))
            }
        }
    }
}

use hex;

fn hex_string_to_fixed_bytes(s: &str) -> Result<[u8; 32], String> {
    let s = s.trim_start_matches("0x");

    let bytes = hex::decode(s).map_err(|e| e.to_string())?;

    bytes
        .try_into()
        .map_err(|_| "Invalid length: expected 32 bytes".to_string())
}

/// Get list of apps a participant is eligible to sign to
///
/// # Description
/// Returns a list of applications where the given address is a registered participant.
///
/// # Route
/// `GET /v1/enigma/participant_apps/{address}`
///
/// # Path Parameters
/// * `address` - The public address of the participant
///
/// # Returns
/// JSON response with list of apps
#[tracing::instrument(
    skip(pool),
    fields(
        address = %address,
        endpoint = "enigma_get_participant_apps"
    )
)]
#[get("/participant_apps/{address}")]
pub async fn get_participant_apps(
    address: web::Path<String>,
    pool: web::Data<Pool<AsyncPgConnection>>,
) -> HttpResponse {
    tracing::info!(
        address = %address,
        "fetching apps for participant"
    );

    let mut connection = match get_connection(&pool).await {
        Ok(conn) => conn,
        Err(e) => return e,
    };

    match db::controllers::mpc_participants::get_apps_by_participant(
        &mut connection,
        &address,
    )
    .await
    {
        Ok(apps) => {
            tracing::info!(
                count = apps.len(),
                "successfully fetched participant apps"
            );
            HttpResponse::Ok().json(apps)
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch participant apps");
            HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to fetch participant apps: {}", e)
            }))
        }
    }
}

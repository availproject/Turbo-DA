use crate::config::AppConfig;
use actix_web::{get, web, HttpResponse};
use avail_rust::H256;
use avail_utils::retrieve_data::retrieve_data;
use db::controllers::{
    customer_expenditure::{get_customer_expenditure_by_submission_id, handle_submission_info},
    misc::validate_and_get_entries,
};
use diesel::result::Error;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use enigma::{types::DecryptRequest, EnigmaEncryptionService};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{str::FromStr, sync::Arc};
use turbo_da_core::{
    logger::debug,
    utils::{generate_avail_sdk, get_connection},
};
use uuid::Uuid;

#[derive(Deserialize, Serialize)]
struct RetrievePreImage {
    submission_id: String,
}

/// Retrieve the pre-image data associated with a submission ID.
///
/// # Description
/// This endpoint allows users to retrieve the pre-image data that was previously submitted to Avail using a specific submission ID.
///
/// # Route
/// `GET /user/get_pre_image`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request. This token must belong to the user making the request.
///
/// # URL Parameters
/// * `submission_id` - The ID of the submission for which you want to retrieve the pre-image data. This ID should be provided as a URL parameter.
///
/// # Returns
/// A JSON object containing the pre-image data associated with the provided submission ID. If the submission ID is not found or if there is an error, the response will reflect that.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/get_pre_image?submission_id=<SUBMISSION_ID>" \
///      -H "Authorization: Bearer YOUR_TOKEN" \
///      -H "Content-Type: application/json"
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "pre_image_data": "011010101010101010100101",
///   "submission_id": "<SUBMISSION_ID>"
/// }
/// ```

#[get("/get_pre_image")]
pub async fn get_pre_image(
    request_payload: web::Query<RetrievePreImage>,
    config: web::Data<AppConfig>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> HttpResponse {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };
    let submission_id = match Uuid::from_str(&request_payload.submission_id) {
        Ok(val) => val,
        Err(e) => {
            return HttpResponse::NotAcceptable().json(json!({ "error": e.to_string() }));
        }
    };

    match get_customer_expenditure_by_submission_id(&mut connection, submission_id).await {
        Ok(sub) => {
            debug(&format!(
                "Found expenditure for submission ID: {:?}",
                submission_id
            ));
            if sub.payload.is_some() {
                return HttpResponse::Ok().body(sub.payload.unwrap());
            }

            if sub.extrinsic_index.is_none() || sub.block_hash.is_none() {
                return HttpResponse::NotImplemented()
                    .body("Customer Expenditure found but tx isn't finalised yet.");
            }
            let sdk = generate_avail_sdk(&Arc::new(config.avail_rpc_endpoint.clone())).await;
            let b_hash = match hex_string_to_fixed_bytes(sub.block_hash.unwrap().as_str()) {
                Ok(hash) => hash,
                Err(e) => {
                    return HttpResponse::NotImplemented().json(json!({ "error": e }));
                }
            };

            match retrieve_data(sdk, H256::from(b_hash), sub.extrinsic_index.unwrap() as u32).await
            {
                Ok(pre_image) => HttpResponse::Ok().body(pre_image),
                Err(e) => HttpResponse::InternalServerError()
                    .json(json!(format!("Failed to retrieve data. Error {:?}", e))),
            }
        }
        Err(Error::NotFound) => HttpResponse::NotFound()
            .json(json!({ "error": "Customer Expenditure entry not found" })),
        Err(_) => HttpResponse::InternalServerError().json(json!({ "error": "Database error" })),
    }
}

/// Query parameters for retrieving submission information
#[derive(Deserialize, Serialize)]
struct GetSubmissionInfo {
    submission_id: String,
}

/// Retrieves information about a specific submission
///
/// # Arguments
/// * `request_payload` - Query parameters containing submission ID
/// * `injected_dependency` - Database connection pool
///
/// # Returns
/// * `HttpResponse` - JSON response containing submission details or error
///
/// # Description
/// Validates the submission ID as a UUID and retrieves associated information
/// from the database. Returns error responses for invalid UUIDs or failed queries.
#[get("/get_submission_info")]
pub async fn get_submission_info(
    request_payload: web::Query<GetSubmissionInfo>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> HttpResponse {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };
    let submission_id = match Uuid::from_str(&request_payload.submission_id) {
        Ok(val) => val,
        Err(e) => {
            return HttpResponse::NotAcceptable().json(json!({ "error": e.to_string() }));
        }
    };
    match handle_submission_info(&mut connection, submission_id).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::InternalServerError().json(json!({ "error": e.to_string() })),
    }
}

/// Query parameters for decrypting data
#[derive(Deserialize, Serialize)]
struct DecryptDataRequest {
    submission_id: String,
}

/// Retrieves information about a specific submission and decrypts the data
///
/// # Arguments
/// * `request_payload` - Query parameters containing submission ID
/// * `injected_dependency` - Database connection pool
/// * `encipher_encryption_service` - Encipher encryption service
///
/// # Returns
/// * `HttpResponse` - JSON response containing submission details or error
///
/// # Description
/// Validates the submission ID as a UUID and retrieves the customer expenditure entry.
/// Returns error responses for invalid UUIDs or failed queries.
/// Decrypts the data using the ephemeral public key and the ciphertext.
/// Returns the decrypted data.
#[get("/decrypt_data")]
pub async fn decrypt_data(
    request_payload: web::Query<DecryptDataRequest>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    enigma_encryption_service: web::Data<EnigmaEncryptionService>,
    config: web::Data<AppConfig>,
) -> HttpResponse {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };
    let submission_id = match Uuid::from_str(&request_payload.submission_id) {
        Ok(val) => val,
        Err(e) => {
            return HttpResponse::NotAcceptable().json(json!({ "error": e.to_string() }));
        }
    };
    let submission =
        match get_customer_expenditure_by_submission_id(&mut connection, submission_id).await {
            Ok(sub) => sub,
            Err(e) => {
                return HttpResponse::InternalServerError().json(json!({ "error": e.to_string() }));
            }
        };
    let (app_id, _) = match validate_and_get_entries(&mut connection, &submission.app_id).await {
        Ok(app) => app,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({ "error": e.to_string() }));
        }
    };

    let sdk = generate_avail_sdk(&Arc::new(config.avail_rpc_endpoint.clone())).await;

    // If the payload is not found, retrieve it from the Avail DA client
    // Assuming that if payload is found in submission table, it means that the tx is not finalised yet on Avail DA
    let payload = if submission.payload.is_none() {
        if submission.extrinsic_index.is_none() || submission.block_hash.is_none() {
            return HttpResponse::NotImplemented()
                .body("Customer Expenditure found but tx isn't finalised yet.");
        }

        retrieve_data(
            sdk,
            H256::from_str(&submission.block_hash.unwrap()).unwrap(),
            submission.extrinsic_index.unwrap() as u32,
        )
        .await
        .map_err(|e| HttpResponse::InternalServerError().json(json!({ "error": e.to_string() })))
        .unwrap()
    } else {
        submission.payload.clone().unwrap()
    };

    let (ephemeral_pub_key, ciphertext) = get_key_and_ciphertext_from_payload(payload);

    let decrypted_data = match enigma_encryption_service
        .decrypt(DecryptRequest {
            app_id: app_id as u32,
            ciphertext: ciphertext,
            ephemeral_pub_key: ephemeral_pub_key,
        })
        .await
    {
        Ok(decrypted_data) => decrypted_data,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({ "error": e.to_string() }));
        }
    };
    HttpResponse::Ok().json(json!({ "data": decrypted_data }))
}

/// Retrieves the ephemeral public key and the ciphertext from the submission.
///
/// # Arguments
/// * `payload` - The submission data
///
/// # Returns
/// * `(Vec<u8>, Vec<u8>)` - The ephemeral public key and the ciphertext
fn get_key_and_ciphertext_from_payload(payload: Vec<u8>) -> (Vec<u8>, Vec<u8>) {
    let key = payload[0..65].to_vec();
    let ciphertext = payload[65..].to_vec();
    (key, ciphertext)
}

use hex;

fn hex_string_to_fixed_bytes(s: &str) -> Result<[u8; 32], String> {
    let s = s.trim_start_matches("0x");

    let bytes = hex::decode(s).map_err(|e| e.to_string())?;

    bytes
        .try_into()
        .map_err(|_| "Invalid length: expected 32 bytes".to_string())
}

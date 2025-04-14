use crate::config::AppConfig;
use actix_web::{get, web, HttpResponse};
use avail_rust::H256;
use avail_utils::retrieve_data::retrieve_data;
use db::controllers::customer_expenditure::handle_submission_info;
use db::{
    models::customer_expenditure::CustomerExpenditureGet, schema::customer_expenditures::dsl::*,
};
use diesel::{prelude::*, result::Error};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection, RunQueryDsl};
use log::info;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{str::FromStr, sync::Arc};
use turbo_da_core::utils::{generate_avail_sdk, get_connection};
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

    match customer_expenditures
        .filter(id.eq(submission_id))
        .select(CustomerExpenditureGet::as_select())
        .first::<CustomerExpenditureGet>(&mut connection)
        .await
    {
        Ok(sub) => {
            info!("Found expenditure for submission ID: {:?}", submission_id);
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

use hex;

fn hex_string_to_fixed_bytes(s: &str) -> Result<[u8; 32], String> {
    let s = s.trim_start_matches("0x");

    let bytes = hex::decode(s).map_err(|e| e.to_string())?;

    bytes
        .try_into()
        .map_err(|_| "Invalid length: expected 32 bytes".to_string())
}

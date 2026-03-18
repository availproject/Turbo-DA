use crate::{config::AppConfig, utils::retrieve_user_id_from_jwt};
use actix_web::{post, web, HttpRequest, HttpResponse, Responder};

use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

#[derive(Deserialize, Serialize)]
pub struct GenerateAccessTokenRequest {
    pub level_name: String,
    pub ttl_in_secs: Option<u64>,
}

#[derive(Deserialize, Serialize)]
pub struct SumsubAccessTokenResponse {
    pub token: String,
    #[serde(rename = "userId")]
    pub user_id: String,
}

/// Generate Sumsub signature for API authentication
fn generate_sumsub_signature(
    secret: &str,
    ts: u64,
    method: &str,
    path: &str,
    body: &str,
) -> Result<String, String> {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|e| format!("Invalid key: {}", e))?;

    let message = format!("{}{}{}{}", ts, method, path, body);
    mac.update(message.as_bytes());
    let result = mac.finalize();

    Ok(const_hex::encode(result.into_bytes()))
}

/// Generate access token for KYC verification
///
/// # Description
/// Creates a Sumsub access token that can be used to initialize the WebSDK for KYC verification.
/// The token allows users to complete identity verification through Sumsub's interface.
///
/// # Route
/// `POST /v1/user/kyc/generate_access_token`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "level_name": "basic-kyc-level",
///   "ttl_in_secs": 3600
/// }
/// ```
///
/// # Returns
/// JSON response containing the access token and user information
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Access token generated successfully",
///   "data": {
///     "token": "act_abc123...",
///     "user_id": "user@example.com"
///   }
/// }
/// ```
#[post("/kyc/generate_access_token")]
pub async fn generate_access_token(
    http_request: HttpRequest,
    payload: web::Json<GenerateAccessTokenRequest>,
    config: web::Data<AppConfig>,
    _pool: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    tracing::info!("generating kyc access token");

    let user_id = match retrieve_user_id_from_jwt(&http_request) {
        Some(id) => id,
        None => {
            tracing::error!("failed to retrieve user id from jwt");
            return HttpResponse::Unauthorized().json(json!({
                "state": "ERROR",
                "error": "Invalid or missing authentication token"
            }));
        }
    };

    let ttl = payload.ttl_in_secs.unwrap_or(3600);
    let path = format!(
        "/resources/accessTokens?userId={}&levelName={}&ttlInSecs={}",
        urlencoding::encode(&user_id),
        urlencoding::encode(&payload.level_name),
        ttl
    );
    let method = "POST";
    let body = ""; // Empty body for this endpoint
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Generate signature
    let signature =
        match generate_sumsub_signature(&config.sumsub_secret_key, ts, method, &path, body) {
            Ok(sig) => sig,
            Err(e) => {
                tracing::error!(error = ?e, "failed to generate signature");
                return HttpResponse::InternalServerError().json(json!({
                    "state": "ERROR",
                    "error": "Failed to generate authentication signature"
                }));
            }
        };

    // Make request to Sumsub
    let client = Client::new();
    let url = format!("{}{}", config.sumsub_base_url, path);

    tracing::info!(url = %url, "making request to sumsub");

    let response = match client
        .post(&url)
        .header("X-App-Token", &config.sumsub_app_token)
        .header("X-App-Access-Ts", ts.to_string())
        .header("X-App-Access-Sig", &signature)
        .header("Content-Type", "application/json")
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!(error = ?e, "failed to make request to sumsub");
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "Failed to communicate with KYC service"
            }));
        }
    };

    let status = response.status();
    let response_text = match response.text().await {
        Ok(text) => text,
        Err(e) => {
            tracing::error!(error = ?e, "failed to read response from sumsub");
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "Failed to read KYC service response"
            }));
        }
    };

    if !status.is_success() {
        tracing::error!(
            status = %status,
            response = %response_text,
            "sumsub api error"
        );
        return HttpResponse::BadRequest().json(json!({
            "state": "ERROR",
            "error": "KYC service returned an error",
            "details": response_text
        }));
    }

    // Parse Sumsub response
    let sumsub_response: SumsubAccessTokenResponse = match serde_json::from_str(&response_text) {
        Ok(resp) => resp,
        Err(e) => {
            tracing::error!(
                error = ?e,
                response = %response_text,
                "failed to parse sumsub response"
            );
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "Invalid response from KYC service"
            }));
        }
    };

    tracing::info!(user_id = %user_id, "successfully generated access token");

    HttpResponse::Ok().json(json!({
        "state": "SUCCESS",
        "message": "Access token generated successfully",
        "data": {
            "token": sumsub_response.token,
            "user_id": sumsub_response.user_id
        }
    }))
}

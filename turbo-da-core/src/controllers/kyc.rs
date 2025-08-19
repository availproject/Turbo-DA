use crate::{
    config::AppConfig,
    logger::{error, info},
    utils::{get_connection, retrieve_user_id_from_jwt},
};
use actix_web::{post, web, HttpRequest, HttpResponse, Responder};
use chrono::Utc;
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

    Ok(hex::encode(result.into_bytes()))
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
    info(&"Generating KYC access token".to_string());

    let user_id = match retrieve_user_id_from_jwt(&http_request) {
        Some(id) => id,
        None => {
            error(&"Failed to retrieve user ID from JWT".to_string());
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
                error(&format!("Failed to generate signature: {}", e));
                return HttpResponse::InternalServerError().json(json!({
                    "state": "ERROR",
                    "error": "Failed to generate authentication signature"
                }));
            }
        };

    // Make request to Sumsub
    let client = Client::new();
    let url = format!("{}{}", config.sumsub_base_url, path);

    info(&format!("Making request to Sumsub: {}", url));

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
            error(&format!("Failed to make request to Sumsub: {}", e));
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
            error(&format!("Failed to read response from Sumsub: {}", e));
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "Failed to read KYC service response"
            }));
        }
    };

    if !status.is_success() {
        error(&format!(
            "Sumsub API error: Status {}, Response: {}",
            status, response_text
        ));
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
            error(&format!(
                "Failed to parse Sumsub response: {}. Response: {}",
                e, response_text
            ));
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "Invalid response from KYC service"
            }));
        }
    };

    info(&format!(
        "Successfully generated access token for user: {}",
        user_id
    ));

    HttpResponse::Ok().json(json!({
        "state": "SUCCESS",
        "message": "Access token generated successfully",
        "data": {
            "token": sumsub_response.token,
            "user_id": sumsub_response.user_id
        }
    }))
}

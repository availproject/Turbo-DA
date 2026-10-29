/// Forwards a one-off submission from the dashboard playground to the
/// data_submission service, authenticated by the caller's JWT rather than an
/// API key so users can try a post without minting one.
use crate::{
    config::AppConfig,
    utils::{get_connection, retrieve_user_id_from_jwt},
};
use actix_web::{post, web, HttpRequest, HttpResponse, Responder};
use base64::{engine::general_purpose::STANDARD, Engine};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

/// Largest decoded payload the playground accepts, in bytes.
const MAX_PLAYGROUND_PAYLOAD: usize = 512 * 1024;

/// Request payload for a playground submission
#[derive(Deserialize, Serialize)]
pub struct PlaygroundSubmit {
    pub app_id: Uuid,
    /// Base64 encoded payload.
    pub data: String,
}

/// Submit a payload through the dashboard playground
///
/// # Description
/// Ownership of the app is checked here, then the decoded bytes are handed to
/// data_submission's internal route. The upstream status and body are passed
/// back untouched so the playground shows exactly what the submission service
/// reported.
///
/// # Route
/// `POST /v1/user/playground_submit`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "app_id": "uuid-string",
///   "data": "base64-encoded-payload"
/// }
/// ```
///
/// # Returns
/// * The upstream status and JSON body on a forwarded submission
/// * 400 Bad Request if the payload is not valid base64
/// * 404 Not Found if the app does not belong to the user
/// * 413 Payload Too Large if the decoded payload exceeds 512 KiB
/// * 502 Bad Gateway if data_submission could not be reached
/// * 503 Service Unavailable if no internal API key is configured
#[tracing::instrument(
    skip(payload, http_request, injected_dependency, config),
    fields(app_id = %payload.app_id, endpoint = "playground_submit")
)]
#[post("/playground_submit")]
pub async fn playground_submit(
    payload: web::Json<PlaygroundSubmit>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User Id not retrieved",
            }))
        }
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    if let Err(e) =
        db::controllers::apps::get_app_by_id(&mut connection, &user, &payload.app_id).await
    {
        tracing::warn!(error = %e, app_id = %payload.app_id, "app lookup failed for playground submit");
        return HttpResponse::NotFound().json(json!({
            "state": "ERROR",
            "error": "app not found",
        }));
    }

    let decoded = match STANDARD.decode(payload.data.as_bytes()) {
        Ok(decoded) => decoded,
        Err(e) => {
            return HttpResponse::BadRequest().json(json!({
                "state": "ERROR",
                "error": format!("data is not valid base64: {}", e),
            }))
        }
    };

    if decoded.len() > MAX_PLAYGROUND_PAYLOAD {
        return HttpResponse::PayloadTooLarge().json(json!({
            "state": "ERROR",
            "error": format!(
                "payload of {} bytes exceeds the {} byte playground limit",
                decoded.len(),
                MAX_PLAYGROUND_PAYLOAD
            ),
        }));
    }

    if config.internal_api_key.is_empty() {
        return HttpResponse::ServiceUnavailable().json(json!({
            "state": "ERROR",
            "error": "playground submission not configured",
        }));
    }

    let url = format!(
        "{}/internal/v1/submit_raw_data",
        config.data_submission_url.trim_end_matches('/')
    );

    let response = match reqwest::Client::new()
        .post(&url)
        .header("x-internal-key", config.internal_api_key.as_str())
        .header("user_id", user.as_str())
        .header("app_id", payload.app_id.to_string())
        .body(decoded)
        .send()
        .await
    {
        Ok(response) => response,
        Err(e) => {
            tracing::error!(error = %e, url = %url, "failed to reach data submission service");
            return HttpResponse::BadGateway().json(json!({
                "state": "ERROR",
                "error": format!("could not reach data submission service: {}", e),
            }));
        }
    };

    let status = match actix_web::http::StatusCode::from_u16(response.status().as_u16()) {
        Ok(status) => status,
        Err(_) => actix_web::http::StatusCode::BAD_GATEWAY,
    };

    match response.json::<Value>().await {
        Ok(body) => HttpResponse::build(status).json(body),
        Err(e) => {
            tracing::error!(error = %e, "data submission service returned a non-json body");
            HttpResponse::BadGateway().json(json!({
                "state": "ERROR",
                "error": "data submission service returned an unreadable response",
            }))
        }
    }
}

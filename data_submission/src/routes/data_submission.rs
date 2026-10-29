use crate::config::AppConfig;
use crate::utils::{map_user_id_to_thread, retrieve_app_id};
use crate::workload_scheduler::common::Response;
use actix_web::{
    post,
    web::{self, Bytes},
    HttpRequest, HttpResponse, Responder,
};
use db::{
    controllers::{
        apps::get_app_by_id, customer_expenditure::create_customer_expenditure_entry,
        misc::validate_and_get_entries, posting_policy::get_policy,
    },
    models::customer_expenditure::CreateCustomerExpenditure,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::broadcast::Sender;
use turbo_da_core::utils::{format_size, generate_submission_id, get_connection, retrieve_user_id};
use uuid::Uuid;

/// Header a caller uses to pick the Avail app id when the app allows per-post selection.
const AVAIL_APP_ID_HEADER: &str = "x-avail-app-id";

/// Header carrying the shared secret for the internal playground endpoint.
const INTERNAL_KEY_HEADER: &str = "x-internal-key";

/// Source recorded for submissions that came through the dashboard playground.
const PLAYGROUND_SOURCE: &str = "playground";

/// Request payload for submitting string data
#[derive(Deserialize, Serialize, Clone)]
pub struct SubmitData {
    pub data: String,
}

/// Handles submission of string data
///
/// # Arguments
/// * `request_payload` - JSON payload containing the data string
/// * `sender` - Channel sender for broadcasting responses
/// * `injected_dependency` - Database connection pool
/// * `config` - Application configuration
/// * `http_request` - HTTP request containing user authentication
///
/// # Returns
/// * JSON response with submission ID on success
/// * Error response if user validation or database operations fail
#[tracing::instrument(
    skip(request_payload, sender, injected_dependency, config, http_request),
    fields(
        submission_id = tracing::field::Empty,
        user_id = tracing::field::Empty,
        app_id = tracing::field::Empty,
        avail_app_id = tracing::field::Empty,
        data_size = request_payload.data.len()
    )
)]
#[post("/submit_data")]
pub async fn submit_data(
    request_payload: web::Json<SubmitData>,
    sender: web::Data<Sender<Response>>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
    http_request: HttpRequest,
) -> impl Responder {
    if request_payload.data.len() == 0 {
        return HttpResponse::BadRequest().json(json!({ "error": "Data is empty"}));
    }

    tracing::info!("data submission request received");

    _submit_data(
        request_payload.data.as_bytes().to_vec(),
        sender,
        injected_dependency,
        config,
        http_request,
        None,
    )
    .await
}

/// Handles submission of raw binary data
///
/// # Arguments
/// * `request_payload` - Raw bytes payload
/// * `sender` - Channel sender for broadcasting responses
/// * `injected_dependency` - Database connection pool
/// * `config` - Application configuration
/// * `http_request` - HTTP request containing user authentication
///
/// # Returns
/// * JSON response with submission ID on success
/// * Error response if user validation or database operations fail
#[tracing::instrument(
    skip(request_payload, sender, injected_dependency, config, http_request),
    fields(
        submission_id = tracing::field::Empty,
        user_id = tracing::field::Empty,
        app_id = tracing::field::Empty,
        avail_app_id = tracing::field::Empty,
        data_size = request_payload.len()
    )
)]
#[post("/submit_raw_data")]
pub async fn submit_raw_data(
    request_payload: Bytes,
    sender: web::Data<Sender<Response>>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
    http_request: HttpRequest,
) -> impl Responder {
    if request_payload.len() == 0 {
        return HttpResponse::BadRequest().json(json!({ "error": "Data is empty"}));
    }

    tracing::info!("raw data submission request received");

    _submit_data(
        request_payload.to_vec(),
        sender,
        injected_dependency,
        config,
        http_request,
        None,
    )
    .await
}

/// Handles submission of raw binary data on behalf of the dashboard playground
///
/// Unlike the public routes this one is not behind the API key middleware, so it
/// authenticates the caller with a shared secret and then has to establish for
/// itself that the app belongs to the user it was told about.
///
/// # Arguments
/// * `request_payload` - Raw bytes payload
/// * `sender` - Channel sender for broadcasting responses
/// * `injected_dependency` - Database connection pool
/// * `config` - Application configuration holding the internal shared secret
/// * `http_request` - HTTP request carrying `x-internal-key`, `user_id` and `app_id`
///
/// # Returns
/// * JSON response with submission ID on success
/// * 401 if the shared secret is missing, wrong, or the endpoint is disabled
/// * 400 if the caller identity headers are missing or malformed
/// * 404 if the app does not exist or belongs to another user
#[tracing::instrument(
    skip(request_payload, sender, injected_dependency, config, http_request),
    fields(
        submission_id = tracing::field::Empty,
        user_id = tracing::field::Empty,
        app_id = tracing::field::Empty,
        avail_app_id = tracing::field::Empty,
        data_size = request_payload.len()
    )
)]
#[post("/submit_raw_data")]
pub async fn internal_submit_raw_data(
    request_payload: Bytes,
    sender: web::Data<Sender<Response>>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
    http_request: HttpRequest,
) -> impl Responder {
    let provided_key = http_request
        .headers()
        .get(INTERNAL_KEY_HEADER)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();

    if config.internal_api_key.is_empty() || !secrets_match(provided_key, &config.internal_api_key)
    {
        tracing::warn!("rejected internal submission with invalid internal key");
        return HttpResponse::Unauthorized()
            .json(json!({ "state": "ERROR", "error": "Invalid internal key" }));
    }

    if request_payload.is_empty() {
        return HttpResponse::BadRequest().json(json!({ "error": "Data is empty"}));
    }

    let user_id = match retrieve_user_id(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::BadRequest()
                .json(json!({ "state": "ERROR", "error": "user_id header required" }))
        }
    };

    let app_id = match retrieve_app_id(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::BadRequest()
                .json(json!({ "state": "ERROR", "error": "valid app_id header required" }))
        }
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    if let Err(e) = get_app_by_id(&mut connection, &user_id, &app_id).await {
        tracing::warn!(
            user_id = %user_id,
            app_id = %app_id,
            error = %e,
            "internal submission for an app the user does not own"
        );
        return HttpResponse::NotFound()
            .json(json!({ "state": "ERROR", "error": "App not found" }));
    }

    drop(connection);

    tracing::info!("internal raw data submission request received");

    _submit_data(
        request_payload.to_vec(),
        sender,
        injected_dependency,
        config,
        http_request,
        Some(PLAYGROUND_SOURCE.to_string()),
    )
    .await
}

async fn _submit_data(
    request_payload: Vec<u8>,
    sender: web::Data<Sender<Response>>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
    http_request: HttpRequest,
    source: Option<String>,
) -> HttpResponse {
    let app_id = match retrieve_app_id(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError()
                .json(json!({ "error": "App Id not retrieved" }))
        }
    };

    let user_id = match retrieve_user_id(&http_request) {
        Some(val) => val,
        None => {
            tracing::error!("user_id not found in request headers");
            return HttpResponse::InternalServerError()
                .json(json!({ "error": "User Id not retrieved" }));
        }
    };

    // Record user_id in current span
    tracing::Span::current().record("user_id", &user_id.to_string());
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let (account_avail_app_id, _, _) =
        match validate_and_get_entries(&mut connection, &app_id).await {
            Ok(app) => app,
            Err(e) => {
                tracing::error!(error = %e, "app validation failed");
                return HttpResponse::InternalServerError().json(json!({ "error": e }));
            }
        };

    // Record app_id in current span
    tracing::Span::current().record("app_id", &app_id.to_string());

    let avail_app_id = match resolve_avail_app_id(
        &mut connection,
        &http_request,
        &app_id,
        account_avail_app_id,
    )
    .await
    {
        Ok(id) => id,
        Err(response) => return response,
    };

    tracing::Span::current().record("avail_app_id", avail_app_id);

    drop(connection);

    let submission_id = generate_submission_id();

    // Record submission_id in current span
    tracing::Span::current().record("submission_id", &submission_id.to_string());

    tracing::info!(data_size = request_payload.len(), "submission created");

    let expenditure_entry = CreateCustomerExpenditure {
        amount_data: format_size(request_payload.len()),
        user_id: user_id.clone(),
        app_id: app_id,
        id: submission_id,
        error: None,
        payload: Some(request_payload.to_vec()),
        source,
    };

    let consumer_response = Response {
        thread_id: map_user_id_to_thread(&config),
        raw_payload: request_payload.into(),
        submission_id,
        app_id,
        avail_app_id,
    };

    tokio::spawn(async move {
        let mut connection = match get_connection(&injected_dependency).await {
            Ok(conn) => conn,
            Err(_) => {
                tracing::error!(
                    submission_id = %submission_id,
                    "failed to connect to database for expenditure entry"
                );
                return;
            }
        };

        create_customer_expenditure_entry(&mut connection, expenditure_entry).await;
    });

    let _ = sender.send(consumer_response);

    tracing::info!("submission accepted and queued for processing");

    HttpResponse::Ok().json(json!({ "submission_id": submission_id }))
}

/// Picks the Avail app id a submission is posted under.
///
/// Apps keep a single app id unless they opt into per-post selection, in which
/// case the caller must name one and it has to be on the allow list when the app
/// defines one. An empty allow list means any id is acceptable.
async fn resolve_avail_app_id(
    connection: &mut AsyncPgConnection,
    http_request: &HttpRequest,
    app_id: &Uuid,
    account_avail_app_id: i32,
) -> Result<i32, HttpResponse> {
    let (per_post_app_id, allowed_avail_app_ids) = match get_policy(connection, app_id).await {
        Ok(policy) => policy,
        Err(e) => {
            tracing::error!(error = %e, "failed to load posting policy");
            return Err(HttpResponse::InternalServerError().json(
                json!({ "state": "ERROR", "error": "Failed to load posting policy for this app" }),
            ));
        }
    };

    if !per_post_app_id {
        return Ok(account_avail_app_id);
    }

    let header_value = match http_request
        .headers()
        .get(AVAIL_APP_ID_HEADER)
        .and_then(|value| value.to_str().ok())
    {
        Some(value) => value,
        None => {
            tracing::warn!("submission missing required per-post avail app id header");
            return Err(HttpResponse::BadRequest().json(json!({
                "state": "ERROR",
                "error": "x-avail-app-id header required for this app"
            })));
        }
    };

    let requested_avail_app_id = match header_value.trim().parse::<i32>() {
        Ok(id) => id,
        Err(e) => {
            tracing::warn!(error = %e, "unparseable per-post avail app id header");
            return Err(HttpResponse::BadRequest().json(json!({
                "state": "ERROR",
                "error": "x-avail-app-id header must be an integer"
            })));
        }
    };

    if !allowed_avail_app_ids.is_empty() && !allowed_avail_app_ids.contains(&requested_avail_app_id)
    {
        tracing::warn!(
            requested_avail_app_id,
            "requested avail app id is not on the allow list"
        );
        return Err(HttpResponse::Forbidden().json(json!({
            "state": "ERROR",
            "error": "x-avail-app-id is not allowed for this app"
        })));
    }

    Ok(requested_avail_app_id)
}

/// Compares two secrets in time independent of how far they match.
fn secrets_match(provided: &str, expected: &str) -> bool {
    let (provided, expected) = (provided.as_bytes(), expected.as_bytes());
    if provided.len() != expected.len() {
        return false;
    }

    provided
        .iter()
        .zip(expected)
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

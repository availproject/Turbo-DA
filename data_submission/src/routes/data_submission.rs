use crate::utils::map_user_id_to_thread;
use crate::workload_scheduler::common::Response;
use crate::{config::AppConfig, db::customer_expenditure::create_customer_expenditure_entry};
use actix_web::{
    post,
    web::{self, Bytes},
    HttpRequest, HttpResponse, Responder,
};
use db::models::customer_expenditure::CreateCustomerExpenditure;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use log::error;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::broadcast::Sender;
use turbo_da_core::{
    db::users::validate_and_get_entries,
    utils::{format_size, generate_submission_id, get_connection, retrieve_user_id},
};

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
#[post("/submit_data")]
pub async fn submit_data(
    request_payload: web::Json<SubmitData>,
    sender: web::Data<Sender<Response>>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
    http_request: HttpRequest,
) -> impl Responder {
    let user = match retrieve_user_id(http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let (avail_app_id, _) = match validate_and_get_entries(&mut connection, &user).await {
        Ok(app) => app,
        Err(e) => {
            return HttpResponse::InternalServerError().body(e);
        }
    };

    drop(connection);

    let submission_id = generate_submission_id();
    let response = Response {
        thread_id: map_user_id_to_thread(&config),
        raw_payload: request_payload.data.as_bytes().to_vec().into(),
        submission_id,
        user_id: user.clone(),
        app_id: avail_app_id,
    };

    let expenditure_entry = CreateCustomerExpenditure {
        amount_data: format_size(request_payload.data.as_bytes().len()),
        user_id: user,
        id: submission_id,
        error: None,
        payload: Some(request_payload.data.as_bytes().to_vec()),
    };

    tokio::spawn(async move {
        let mut connection = match get_connection(&injected_dependency).await {
            Ok(conn) => conn,
            Err(_) => {
                error!("couldn't connect to db with error ");
                return;
            }
        };

        create_customer_expenditure_entry(&mut connection, expenditure_entry).await;
    });

    let _ = sender.send(response);

    HttpResponse::Ok().json(json!({ "submission_id": submission_id }))
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
#[post("/submit_raw_data")]
pub async fn submit_raw_data(
    request_payload: Bytes,
    sender: web::Data<Sender<Response>>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
    http_request: HttpRequest,
) -> impl Responder {
    let user = match retrieve_user_id(http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError()
                .json(json!({ "error": "User Id not retrieved" }))
        }
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let (avail_app_id, _) = match validate_and_get_entries(&mut connection, &user).await {
        Ok(app) => app,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({ "error": e }));
        }
    };

    drop(connection);

    let submission_id = generate_submission_id();

    let expenditure_entry = CreateCustomerExpenditure {
        amount_data: format_size(request_payload.len()),
        user_id: user.clone(),
        id: submission_id,
        error: None,
        payload: Some(request_payload.to_vec()),
    };

    let consumer_response = Response {
        thread_id: map_user_id_to_thread(&config),
        raw_payload: request_payload,
        submission_id,
        user_id: user,
        app_id: avail_app_id,
    };

    tokio::spawn(async move {
        let mut connection = match get_connection(&injected_dependency).await {
            Ok(conn) => conn,
            Err(_) => {
                error!("couldn't connect to db with error ");
                return;
            }
        };

        create_customer_expenditure_entry(&mut connection, expenditure_entry).await;
    });

    let _ = sender.send(consumer_response);

    HttpResponse::Ok().json(json!({ "submission_id": submission_id }))
}

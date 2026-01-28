use crate::utils::{get_connection, retrieve_user_id_from_jwt};
use actix_web::{delete, get, post, web, HttpRequest, HttpResponse, Responder};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Deserialize, Serialize)]
pub struct AddPublicKeyRequest {
    pub public_address: String,
}

#[derive(Deserialize, Serialize)]
pub struct DeletePublicKeyRequest {
    pub public_address: String,
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

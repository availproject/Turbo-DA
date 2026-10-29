/// A user's saved list of named EVM addresses, used to label deposit sources
/// and payout destinations in the dashboard.
use crate::utils::{get_connection, is_valid_hex_address, retrieve_user_id_from_jwt};
use actix_web::{delete, get, post, put, web, HttpRequest, HttpResponse, Responder};
use db::models::address_book::AddressBookCreate;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

/// Longest accepted entry name and role.
const MAX_NAME_LEN: usize = 64;
const MAX_ROLE_LEN: usize = 64;

/// Request payload for creating an address book entry
#[derive(Deserialize, Serialize)]
pub struct CreateAddressBookEntry {
    pub address: String,
    pub name: String,
    pub role: Option<String>,
}

/// Request payload for updating an address book entry
#[derive(Deserialize, Serialize)]
pub struct UpdateAddressBookEntry {
    pub name: String,
    pub role: Option<String>,
}

/// Trims a name and checks it against the stored column's bounds.
fn validate_name(name: &str) -> Result<String, HttpResponse> {
    let trimmed = name.trim().to_string();
    let length = trimmed.chars().count();

    if length == 0 || length > MAX_NAME_LEN {
        return Err(HttpResponse::BadRequest().json(json!({
            "state": "ERROR",
            "error": format!("name must be between 1 and {} characters", MAX_NAME_LEN),
        })));
    }

    Ok(trimmed)
}

/// Trims a role, mapping a blank value to no role at all.
fn validate_role(role: Option<&String>) -> Result<Option<String>, HttpResponse> {
    let trimmed = role.map(|value| value.trim().to_string());

    match trimmed {
        Some(value) if value.chars().count() > MAX_ROLE_LEN => Err(HttpResponse::BadRequest()
            .json(json!({
                "state": "ERROR",
                "error": format!("role must be at most {} characters", MAX_ROLE_LEN),
            }))),
        Some(value) if value.is_empty() => Ok(None),
        other => Ok(other),
    }
}

/// List the authenticated user's address book
///
/// # Route
/// `GET /v1/user/address_book`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Returns
/// * 200 OK with the entries, newest first
/// * 500 Internal Server Error if the lookup fails
#[tracing::instrument(
    skip(http_request, injected_dependency),
    fields(endpoint = "list_address_book")
)]
#[get("/address_book")]
pub async fn list_address_book(
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
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

    match db::controllers::address_book::list(&mut connection, &user).await {
        Ok(entries) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "address book retrieved successfully",
            "data": entries,
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

/// Add an entry to the authenticated user's address book
///
/// # Route
/// `POST /v1/user/address_book`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "address": "0x...",
///   "name": "Treasury",
///   "role": "deposit"
/// }
/// ```
///
/// # Returns
/// * 200 OK with the created entry
/// * 400 Bad Request if the address, name, or role is invalid
/// * 409 Conflict if the address is already saved by this user
/// * 500 Internal Server Error if the insert fails
#[tracing::instrument(
    skip(payload, http_request, injected_dependency),
    fields(endpoint = "create_address_book_entry")
)]
#[post("/address_book")]
pub async fn create_address_book_entry(
    payload: web::Json<CreateAddressBookEntry>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
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

    if !is_valid_hex_address(&payload.address) {
        return HttpResponse::BadRequest().json(json!({
            "state": "ERROR",
            "error": "invalid ethereum address",
        }));
    }

    let name = match validate_name(&payload.name) {
        Ok(name) => name,
        Err(response) => return response,
    };

    let role = match validate_role(payload.role.as_ref()) {
        Ok(role) => role,
        Err(response) => return response,
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let entry = AddressBookCreate {
        id: Uuid::new_v4(),
        user_id: user,
        address: payload.address.to_lowercase(),
        name,
        role,
    };

    match db::controllers::address_book::create(&mut connection, &entry).await {
        Ok(created) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "address book entry created successfully",
            "data": created,
        })),
        Err(DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, _)) => {
            HttpResponse::Conflict().json(json!({
                "state": "ERROR",
                "error": "address already saved",
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

/// Rename an address book entry
///
/// # Route
/// `PUT /v1/user/address_book/{id}`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "name": "Treasury",
///   "role": "payout"
/// }
/// ```
///
/// # Returns
/// * 200 OK if the entry was updated
/// * 400 Bad Request if the name or role is invalid
/// * 404 Not Found if the entry does not belong to the user
/// * 500 Internal Server Error if the update fails
#[tracing::instrument(
    skip(payload, path, http_request, injected_dependency),
    fields(entry_id = %path, endpoint = "update_address_book_entry")
)]
#[put("/address_book/{id}")]
pub async fn update_address_book_entry(
    path: web::Path<Uuid>,
    payload: web::Json<UpdateAddressBookEntry>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
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

    let name = match validate_name(&payload.name) {
        Ok(name) => name,
        Err(response) => return response,
    };

    let role = match validate_role(payload.role.as_ref()) {
        Ok(role) => role,
        Err(response) => return response,
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let entry_id = path.into_inner();

    match db::controllers::address_book::update(&mut connection, &user, &entry_id, &name, role)
        .await
    {
        Ok(count) if count > 0 => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "address book entry updated successfully",
        })),
        Ok(_) => HttpResponse::NotFound().json(json!({
            "state": "ERROR",
            "error": "address book entry not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

/// Remove an address book entry
///
/// # Route
/// `DELETE /v1/user/address_book/{id}`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Returns
/// * 200 OK if the entry was removed
/// * 404 Not Found if the entry does not belong to the user
/// * 500 Internal Server Error if the delete fails
#[tracing::instrument(
    skip(path, http_request, injected_dependency),
    fields(entry_id = %path, endpoint = "delete_address_book_entry")
)]
#[delete("/address_book/{id}")]
pub async fn delete_address_book_entry(
    path: web::Path<Uuid>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
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

    let entry_id = path.into_inner();

    match db::controllers::address_book::delete(&mut connection, &user, &entry_id).await {
        Ok(count) if count > 0 => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "address book entry deleted successfully",
        })),
        Ok(_) => HttpResponse::NotFound().json(json!({
            "state": "ERROR",
            "error": "address book entry not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

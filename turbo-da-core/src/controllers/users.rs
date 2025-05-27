/// Logging utilities
use crate::logger::{error, info};
/// Core dependencies for user management functionality
use crate::{
    config::AppConfig,
    utils::{get_connection, retrieve_user_id_from_jwt},
};
/// Web framework dependencies for handling HTTP requests and responses
use actix_web::{
    delete, get, post, put,
    web::{self},
    HttpRequest, HttpResponse, Responder,
};
use bigdecimal::BigDecimal;
/// Database models and schema definitions
use db::{
    controllers::{
        apps::{create_account, delete_account_by_id},
        users::user_exists,
    },
    models::{
        api::ApiKeyCreate,
        apps::{AppsCreate, Status},
        user_model::UserCreate,
    },
};
/// Database and async connection handling
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
/// Redis caching functionality
use redis::Commands;
/// Serialization/deserialization
use serde::{Deserialize, Serialize};
use serde_json::json;
/// Cryptographic hashing
use sha3::{Digest, Keccak256};
/// UUID generation
use uuid::Uuid;
/// Input validation
use validator::Validate;

/// Query parameters for retrieving users with optional limit
#[derive(Deserialize, Serialize)]
struct GetAllUsersParams {
    limit: Option<i64>,
    user_id: Option<String>,
}

/// Request payload for user registration
#[derive(Deserialize, Serialize, Validate)]
pub(crate) struct RegisterUser {
    pub name: Option<String>,
}

/// Request payload for user registration
#[derive(Deserialize, Serialize, Validate)]
pub(crate) struct RegisterAccount {
    pub avail_app_id: Option<i32>,
    pub fallback_enabled: bool,
    pub app_name: Option<String>,
    pub app_description: Option<String>,
    pub app_logo: Option<String>,
}

/// Request payload for user registration
#[derive(Deserialize, Serialize, Validate)]
pub(crate) struct EditAccount {
    pub app_id: Uuid,
    pub avail_app_id: Option<i32>,
    pub fallback_enabled: Option<bool>,
    pub app_name: Option<String>,
    pub app_description: Option<String>,
    pub app_logo: Option<String>,
}

/// Request payload for updating a user's app ID
#[derive(Deserialize, Serialize, Validate)]
pub(crate) struct UpdateAppID {
    pub avail_app_id: i32,
    pub app_id: Uuid,
}

/// Retrieves a list of all users with optional limit
///
/// # Description
/// Returns a list of all users in the system, with an optional limit parameter to restrict the number of results.
///
/// # Route
/// `GET /v1/user/get_all_users`
///
/// # Query Parameters
/// * `limit` - Optional parameter to limit the number of users returned
///
/// # Returns
/// JSON response containing a list of users or an appropriate error message
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Users retrieved successfully",
///   "data": [
///     {
///       "id": "user1@example.com",
///       "name": "User One",
///       "credit_balance": "100.00",
///       "credit_used": "25.50",
///       "allocated_credit_balance": "200.00"
///     },
///     {
///       "id": "user2@example.com",
///       "name": "User Two",
///       "credit_balance": "50.00",
///       "credit_used": "10.25",
///       "allocated_credit_balance": "100.00"
///     }
///   ]
/// }
/// ```
#[get("/get_all_users")]
pub async fn get_all_users(
    payload: web::Query<GetAllUsersParams>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let results =
        db::controllers::users::get_all_users(&mut connection, &payload.user_id, &payload.limit)
            .await;

    HttpResponse::Ok().json(json!({
        "state": "SUCCESS",
        "message": "Users retrieved successfully",
        "data": results,
    }))
}

/// Query parameters for retrieving apps with optional limit
#[derive(Deserialize, Serialize)]
struct GetAllAppsParams {
    limit: Option<i64>,
    user_id: Option<String>,
    app_id: Option<Uuid>,
}

/// Retrieves all apps for the authenticated user
///
/// # Description
/// Gets a list of all applications associated with the authenticated user.
///
/// # Route
/// `GET /v1/user/get_apps`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Returns
/// JSON response containing the list of apps or an appropriate error message
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Apps retrieved successfully",
///   "data": [
///     {
///       "id": "uuid-string",
///       "user_id": "user@example.com",
///       "app_id": 1001,
///       "credit_balance": "25.00",
///       "credit_used": "5.50",
///       "fallback_enabled": true
///     }
///   ]
/// }
/// ```

#[get("/get_all_apps")]
pub async fn get_all_apps(
    payload: web::Query<GetAllAppsParams>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let apps =
        db::controllers::apps::get_all_apps(&mut connection, &payload.user_id, &payload.app_id)
            .await;

    match apps {
        Ok(apps) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "Apps retrieved successfully",
            "data": apps,
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

/// Retrieves details for the authenticated user
///
/// # Description
/// Gets user details based on the email address from the authentication token.
///
/// # Route
/// `GET /v1/user/get_user`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Returns
/// JSON response containing user details or an appropriate error message
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "User retrieved successfully",
///   "data": {
///     "id": "user@example.com",
///     "name": "John Doe",
///     "credit_balance": "50.00",
///     "credit_used": "10.25",
///     "allocated_credit_balance": "100.00"
///   }
/// }
/// ```

#[get("/get_user")]
pub async fn get_user(
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user_email = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User Email not retrieved",
            }))
        }
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let user = db::controllers::users::get_user(&mut connection, &user_email).await;
    match user {
        Ok(user) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "User retrieved successfully",
            "data": user,
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

/// Registers a new user in the system
///
/// # Description
/// Creates a new user account with the provided name. The email address is extracted from
/// the authentication token.
///
/// # Route
/// `POST /v1/user/register_new_user`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "name": "John Doe"
/// }
/// ```
///
/// # Returns
/// * 200 OK with success message if registration succeeds
/// * 409 Conflict if user already exists
/// * 400 Bad Request if validation fails
/// * 500 Internal Server Error if user info cannot be retrieved
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Success: John Doe"
/// }
/// ```

#[post("/register_new_user")]
pub async fn register_new_user(
    payload: web::Json<RegisterUser>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    if let Err(errors) = payload.validate() {
        return HttpResponse::BadRequest().json(json!({
            "state": "ERROR",
            "error": errors,
        }));
    }

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let mut user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User Email not retrieved",
            }))
        }
    };

    if user_exists(&mut connection, user.as_mut_str())
        .await
        .is_ok_and(|exists| exists)
    {
        return HttpResponse::Conflict().json(json!({
            "state": "ERROR",
            "error": "User already exists",
        }));
    }

    let username = match payload.name.clone() {
        Some(val) => val,
        None => user.split("@").next().unwrap().to_string(),
    };

    let tx = db::controllers::users::register_new_user(
        &mut connection,
        UserCreate {
            id: user,
            name: username.clone(),
        },
    )
    .await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": format!("Success: {}", username),
        })),
        Err(e) => HttpResponse::NotAcceptable().json(json!({
            "state": "ERROR",
            "error": format!("Error: {}", e)
        })),
    }
}
/// Generate an app account for a user
///
/// # Description
/// Creates a new account with fallback settings and optional app details. The user ID is extracted from
/// the authentication token.
///
/// # Route
/// `POST /v1/user/generate_app_account`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "avail_app_id": 1001,
///   "fallback_enabled": true,
///   "app_name": "My Application",
///   "app_description": "Description of my application",
///   "app_logo": "https://example.com/logo.png"
/// }
/// ```
///
/// # Returns
/// * 200 OK with account details if creation succeeds
/// * 400 Bad Request if validation fails
/// * 406 Not Acceptable if account creation fails
/// * 500 Internal Server Error if user info cannot be retrieved
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Account created successfully",
///   "data": {
///     "id": "uuid-string",
///     "user_id": "user@example.com",
///     "app_id": 1001,
///     "credit_balance": "0",
///     "credit_used": "0",
///     "fallback_enabled": true,
///     "app_name": "My Application",
///     "app_description": "Description of my application",
///     "app_logo": "https://example.com/logo.png"
///   }
/// }
/// ```

#[post("/generate_app_account")]
pub async fn generate_app_account(
    payload: web::Json<RegisterAccount>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    if let Err(errors) = payload.validate() {
        return HttpResponse::BadRequest().json(json!({
            "state": "ERROR",
            "error": errors,
        }));
    }

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User Id not retrieved",
            }))
        }
    };

    let app_id = Uuid::new_v4();
    let avail_app_id = payload.avail_app_id.unwrap_or(0);
    let account = AppsCreate {
        id: app_id,
        user_id: user,
        app_id: avail_app_id,
        credit_balance: BigDecimal::from(0),
        credit_used: BigDecimal::from(0),
        fallback_enabled: payload.fallback_enabled,
        app_name: payload.app_name.clone(),
        app_description: payload.app_description.clone(),
        app_logo: payload.app_logo.clone(),
    };

    let tx = create_account(&mut connection, &account).await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "Account created successfully",
            "data": account
        })),
        Err(e) => HttpResponse::NotAcceptable().json(json!({
            "state": "ERROR",
            "error": format!("Error: {}", e)
        })),
    }
}
/// Updates an existing app account with new information
///
/// # Description
/// Allows a user to update the details of an existing application account, including app name,
/// description, logo, and other settings.
///
/// # Route
/// `PUT /v1/user/edit_app_account`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "app_id": "uuid-string",
///   "avail_app_id": 1001,
///   "fallback_enabled": true,
///   "app_name": "Updated App Name",
///   "app_description": "Updated app description",
///   "app_logo": "https://example.com/logo.png"
/// }
/// ```
///
/// # Returns
/// JSON response indicating success or failure of the update operation
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "App account updated successfully"
/// }
/// ```
#[put("/edit_app_account")]
pub async fn edit_app_account(
    payload: web::Json<EditAccount>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User Id not retrieved",
            }))
        }
    };

    let app_result =
        db::controllers::apps::get_app_by_id(&mut connection, &user, &payload.app_id).await;
    if app_result.is_err() {
        return HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": app_result.err().unwrap().to_string(),
        }));
    }
    let mut account = app_result.unwrap();

    account.app_name = payload.app_name.clone();
    account.app_description = payload.app_description.clone();
    account.app_logo = payload.app_logo.clone();

    if let Some(fallback_enabled) = payload.fallback_enabled {
        if fallback_enabled != account.fallback_enabled {
            account.fallback_enabled = fallback_enabled;
            match account.fallback_updated_at {
                Some(fallback_updated_at) => {
                    account.fallback_updated_at = Some(
                        [
                            &fallback_updated_at[..],
                            &[Some(Status::new(chrono::Utc::now(), fallback_enabled))],
                        ]
                        .concat(),
                    );
                }
                None => {
                    account.fallback_updated_at = Some(vec![Some(Status::new(
                        chrono::Utc::now(),
                        fallback_enabled,
                    ))]);
                }
            }
        }
    }

    let tx = db::controllers::apps::update_app_account(&mut connection, &account).await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "App account updated successfully",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}
/// Retrieves all apps for the authenticated user
///
/// # Description
/// Gets a list of all applications associated with the authenticated user.
///
/// # Route
/// `GET /v1/user/get_apps`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Returns
/// JSON response containing the list of apps or an appropriate error message
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Apps retrieved successfully",
///   "data": [
///     {
///       "id": "uuid-string",
///       "user_id": "user@example.com",
///       "app_id": 1001,
///       "credit_balance": "25.00",
///       "credit_used": "5.50",
///       "fallback_enabled": true
///     }
///   ]
/// }
/// ```

#[get("/get_apps")]
pub async fn get_apps(
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let apps = db::controllers::apps::get_apps(&mut connection, &user).await;

    match apps {
        Ok(apps) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "Apps retrieved successfully",
            "data": apps,
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

#[derive(Deserialize, Serialize, Validate)]
pub struct DeleteAccount {
    pub app_id: Uuid,
}

/// Delete an account for the authenticated user
///
/// # Description
/// Deletes the specified account associated with the authenticated user.
///
/// # Route
/// `DELETE /v1/user/delete_account`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "app_id": "uuid-string"
/// }
/// ```
///
/// # Returns
/// * 200 OK with success message if deletion succeeds
/// * 404 Not Found if account doesn't exist
/// * 500 Internal Server Error if deletion fails
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Account successfully deleted"
/// }
/// ```

#[delete("/delete_account")]
pub async fn delete_account(
    payload: web::Json<DeleteAccount>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    // Delete the account
    let tx = delete_account_by_id(&mut connection, user.clone(), payload.app_id).await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "Account successfully deleted",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": format!("Error deleting account: {}", e),
        })),
    }
}

#[derive(Deserialize, Serialize, Validate)]
pub struct AllocateCreditBalance {
    pub amount: BigDecimal,
    pub app_id: Uuid,
}

/// Allocate credit balance to a user account
///
/// # Description
/// Allocates the specified amount of credits to the user's account.
///
/// # Route
/// `POST /v1/user/allocate_credit_balance`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "amount": "100.00",
///   "app_id": "uuid-string"
/// }
/// ```
///
/// # Returns
/// * 200 OK with success message if allocation succeeds
/// * 500 Internal Server Error if allocation fails
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "Credit balance allocated successfully"
/// }
/// ```

#[post("/allocate_credit_balance")]
pub async fn allocate_credit(
    payload: web::Json<AllocateCreditBalance>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let tx = db::controllers::misc::allocate_credit_balance(
        &mut connection,
        &payload.app_id,
        &user,
        &payload.amount,
    )
    .await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "Credit balance allocated successfully",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

#[derive(Deserialize, Serialize, Validate)]
pub struct ReclaimCredits {
    pub app_id: Uuid,
    pub amount: BigDecimal,
}

#[post("/reclaim_credits")]
pub async fn reclaim_credits(
    payload: web::Json<ReclaimCredits>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let tx = db::controllers::misc::reclaim_credits(
        &mut connection,
        &payload.app_id,
        &user,
        &payload.amount,
    )
    .await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "Credits reclaimed successfully",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

#[derive(Deserialize, Serialize, Validate)]
pub struct GenerateApiKey {
    pub app_id: Uuid,
}

/// Generate a new API key for the authenticated user
///
/// # Description
/// Creates a new API key associated with the specified account.
///
/// # Route
/// `POST /v1/user/generate_api_key`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "app_id": "uuid-string"
/// }
/// ```
///
/// # Returns
/// * 200 OK with the new API key if generation succeeds
/// * 500 Internal Server Error if generation fails
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "API key created successfully",
///   "data": {
///     "api_key": "abcdef1234567890"
///   }
/// }
/// ```

#[post("/generate_api_key")]
async fn generate_api_key(
    payload: web::Json<GenerateApiKey>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let key = Uuid::new_v4().to_string().replace("-", "");

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let mut hasher = Keccak256::new();
    hasher.update(key.as_bytes());
    let hashed_password = hasher.finalize();
    let tx = db::controllers::api_keys::create_api_key(
        &mut connection,
        &ApiKeyCreate {
            api_key: hex::encode(hashed_password),
            user_id: user,
            identifier: key[key.len() - 5..].to_string(),
            app_id: payload.app_id,
        },
    )
    .await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "API key created successfully",
            "data": {
                "api_key": key
            }
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

/// Retrieve all API keys for the authenticated user
///
/// # Description
/// Returns a list of all API keys associated with the authenticated user.
///
/// # Route
/// `GET /v1/user/get_api_key`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Returns
/// * 200 OK with a list of API keys if retrieval succeeds
/// * 500 Internal Server Error if retrieval fails
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "API key retrieved successfully",
///   "data": [
///     {
///       "api_key": "***********abc12",
///       "identifier": "abc12",
///       "created_at": "2023-01-01T12:00:00Z",
///       "user_id": "user-id-string",
///       "app_id": "uuid-string"
///     }
///   ]
/// }
/// ```

#[get("/get_api_keys")]
pub async fn get_api_keys(
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

    let query = db::controllers::api_keys::get_api_keys(&mut connection, &user).await;

    match query {
        Ok(key) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "API key retrieved successfully",
            "data": key
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

/// Request payload for deleting an API key
#[derive(Deserialize, Serialize, Validate)]
pub struct DeleteApiKey {
    pub identifier: String,
}

/// Delete an API key for the authenticated user
///
/// # Description
/// Removes the specified API key from both the database and Redis cache.
///
/// # Route
/// `DELETE /v1/user/delete_api_key`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "identifier": "abc12"
/// }
/// ```
///
/// # Returns
/// * 200 OK with success message and deleted key identifier if deletion succeeds
/// * 404 Not Found if key doesn't exist
/// * 500 Internal Server Error if deletion fails
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "API key deleted successfully",
///   "data": {
///     "api_key": "abc12"
///   }
/// }
/// ```

#[delete("/delete_api_key")]
async fn delete_api_key(
    payload: web::Json<DeleteApiKey>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
) -> impl Responder {
    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let query =
        db::controllers::api_keys::delete_api_key(&mut connection, &user, &payload.identifier)
            .await;

    match query {
        Ok(row) => {
            if row.is_empty() {
                return HttpResponse::NotFound().body("API key not found");
            }
            let hashed_key = &row[0].api_key;
            match redis::Client::open(config.redis_url.clone().as_str()) {
                Ok(mut client) => {
                    let _result: Result<(), redis::RedisError> = client.del(hashed_key);
                    info(&format!("Deleted API key from Redis: {}", hashed_key));
                }
                Err(e) => {
                    error(&format!("Error connecting to Redis: {}", e));
                }
            }
            return HttpResponse::Ok().json(json!({
                "state": "SUCCESS",
                "message": "API key deleted successfully",
                "data": {
                    "api_key": payload.identifier
                }
            }));
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };
}

/// Update the app_id for a user account
///
/// # Description
/// Changes the app_id associated with the specified account.
///
/// # Route
/// `PUT /v1/user/update_app_id`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "avail_app_id": 1002,
///   "app_id": "uuid-string"
/// }
/// ```
///
/// # Returns
/// * 200 OK with success message if update succeeds
/// * 500 Internal Server Error if update fails
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "App ID updated successfully",
///   "error": null
/// }
/// ```

#[put("/update_app_id")]
async fn update_app_id(
    payload: web::Json<UpdateAppID>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> HttpResponse {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => {
            return HttpResponse::InternalServerError().json(json!({
                "state": "ERROR",
                "error": "User Id not retrieved",
            }))
        }
    };

    let query = db::controllers::apps::update_app_id(
        &mut connection,
        &payload.app_id,
        &user,
        payload.avail_app_id,
    )
    .await;

    match query {
        Ok(_) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "App ID updated successfully",
            "error": null
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

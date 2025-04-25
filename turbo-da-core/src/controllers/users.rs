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
        accounts::{create_account, delete_account_by_user_id},
        users::user_exists,
    },
    models::{accounts::AccountCreate, api::ApiKeyCreate, user_model::UserCreate},
};
/// Database and async connection handling
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
/// Logging utilities
use log::{error, info};
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
}

/// Request payload for user registration
#[derive(Deserialize, Serialize, Validate)]
pub(crate) struct RegisterUser {
    pub name: Option<String>,
    pub app_id: i32,
}

/// Request payload for user registration
#[derive(Deserialize, Serialize, Validate)]
pub(crate) struct RegisterAccount {
    pub app_id: i32,
    pub fallback_enabled: bool,
}

/// Request payload for updating a user's app ID
#[derive(Deserialize, Serialize, Validate)]
pub(crate) struct UpdateAppID {
    pub app_id: i32,
}

/// Retrieves a list of all users with optional limit
///
/// # Arguments
/// * `payload` - Query parameters containing optional limit
/// * `config` - Application configuration
/// * `injected_dependency` - Database connection pool
///
/// # Returns
/// JSON response containing list of users or error
#[get("/get_all_users")]
pub async fn get_all_users(
    payload: web::Query<GetAllUsersParams>,
    config: web::Data<AppConfig>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let limit = payload.into_inner().limit;
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let final_limit = match limit {
        Some(l) => l,
        None => config.total_users_query_limit,
    };
    let results = db::controllers::users::get_all_users(&mut connection, final_limit).await;

    HttpResponse::Ok().json(json!({"results":results}))
}

/// Retrieves details for the authenticated user.
///
/// # Description
/// Gets user details based on the email address from the authentication token.
///
/// # Route
/// `GET v1/user/get_user`
///
/// # Returns
/// An `HttpResponse` containing the user's details or an appropriate error message.
///
/// # Example Response
/// ```json
/// {
///   "id": "1",
///   "name": "John Doe",
///   "email": "john@example.com",
///   "app_id": 1001,
///   "assigned_wallet": "0x123..."
/// }
/// ```

#[get("/get_user")]
pub async fn get_user(
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user_email = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Email not retrieved"),
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let user = db::controllers::users::get_user(&mut connection, &user_email).await;
    match user {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(e) => HttpResponse::InternalServerError().json(json!({ "error": e.to_string() })),
    }
}

/// Registers a new user in the system.
///
/// # Description
/// Creates a new user account with the provided name and app_id. The email address is extracted from
/// the authentication token.
///
/// # Route
/// `POST v1/users/register_new_user`
///
/// # Request Body
/// ```json
/// {
///   "name": "John Doe",
///   "app_id": 1001
/// }
/// ```
///
/// # Returns
/// - 200 OK with success message if registration succeeds
/// - 409 Conflict if user already exists
/// - 400 Bad Request if validation fails
/// - 500 Internal Server Error if user info cannot be retrieved

#[post("/register_new_user")]
pub async fn register_new_user(
    payload: web::Json<RegisterUser>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    if let Err(errors) = payload.validate() {
        return HttpResponse::BadRequest().json(errors);
    }

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let mut user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Email not retrieved"),
    };

    if user_exists(&mut connection, user.as_mut_str())
        .await
        .is_ok_and(|exists| exists)
    {
        return HttpResponse::Conflict().body("User already exists");
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
            app_id: payload.app_id,
        },
    )
    .await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({ "message": format!("Success: {}", username) })),
        Err(e) => HttpResponse::NotAcceptable().json(json!({ "error": format!("Error: {}", e) })),
    }
}
/// Generate an app account for a user in the system.
///
/// # Description
/// Creates a new account with the provided app_id and fallback settings. The user ID is extracted from
/// the authentication token.
///
/// # Route
/// `POST v1/users/generate_app_account`
///
/// # Request Body
/// ```json
/// {
///   "app_id": 1001,
///   "fallback_enabled": true
/// }
/// ```
///
/// # Returns
/// - 200 OK with success message if account creation succeeds
/// - 400 Bad Request if validation fails
/// - 406 Not Acceptable if account creation fails
/// - 500 Internal Server Error if user info cannot be retrieved

#[post("/generate_app_account")]
pub async fn generate_app_account(
    payload: web::Json<RegisterAccount>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    http_request: HttpRequest,
) -> impl Responder {
    if let Err(errors) = payload.validate() {
        return HttpResponse::BadRequest().json(errors);
    }

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let user = match retrieve_user_id_from_jwt(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let tx = create_account(
        &mut connection,
        AccountCreate {
            user_id: user,
            credit_balance: BigDecimal::from(0),
            credit_used: BigDecimal::from(0),
            fallback_enabled: payload.fallback_enabled,
        },
    )
    .await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({ "message": format!("Success") })),
        Err(e) => HttpResponse::NotAcceptable().json(json!({ "error": format!("Error: {}", e) })),
    }
}

/// Delete an account for the authenticated user.
///
/// # Description
/// Deletes the account associated with the user ID extracted from the authentication token.
///
/// # Route
/// `DELETE v1/users/delete_account`
///
/// # Returns
/// - 200 OK with success message if account deletion succeeds
/// - 404 Not Found if account doesn't exist
/// - 500 Internal Server Error if user info cannot be retrieved or deletion fails

#[delete("/delete_account")]
pub async fn delete_account(
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
    let tx = delete_account_by_user_id(&mut connection, user.clone()).await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({ "message": "Account successfully deleted" })),
        Err(e) => HttpResponse::InternalServerError()
            .json(json!({ "error": format!("Error deleting account: {}", e) })),
    }
}

#[derive(Deserialize, Serialize, Validate)]
pub struct AllocateCreditBalance {
    pub amount: BigDecimal,
    pub account_id: Uuid,
}
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

    let tx = db::controllers::accounts::allocate_credit_balance(
        &mut connection,
        &payload.account_id,
        &user,
        &payload.amount,
    )
    .await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({ "message": "Credit balance allocated" })),
        Err(e) => {
            HttpResponse::InternalServerError().json(json!({ "error": format!("Error: {}", e) }))
        }
    }
}

/// Generates a new API key for the authenticated user
///
/// # Arguments
/// * `http_request` - The HTTP request containing user authentication
/// * `injected_dependency` - Database connection pool
///
/// # Returns
/// JSON response containing the new API key or error message
#[post("/generate_api_key")]
async fn generate_api_key(
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
        },
    )
    .await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({ "api_key": key })),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

/// Retrieves all API keys for the authenticated user
///
/// # Arguments
/// * `http_request` - The HTTP request containing user authentication
/// * `injected_dependency` - Database connection pool
///
/// # Returns
/// JSON response containing list of API keys or error message
#[get("/get_api_key")]
pub async fn get_api_key(
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

    let query = db::controllers::api_keys::get_api_key(&mut connection, &user).await;

    match query {
        Ok(key) => HttpResponse::Ok().json(key),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

/// Request payload for deleting an API key
#[derive(Deserialize, Serialize, Validate)]
pub struct DeleteApiKey {
    pub identifier: String,
}

/// Deletes an API key for the authenticated user.
///
/// # Description
/// Removes the specified API key from both the database and Redis cache.
///
/// # Route
/// `DELETE v1/users/delete_api_key`
///
/// # Request Body
/// ```json
/// {
///   "identifier": "abc12"
/// }
/// ```
///
/// # Returns
/// - 200 OK with deleted key identifier
/// - 404 Not Found if key doesn't exist
/// - 500 Internal Server Error if deletion fails

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
                    info!("Deleted API key from Redis: {}", hashed_key);
                }
                Err(e) => {
                    error!("Error connecting to Redis: {}", e);
                }
            }
            return HttpResponse::Ok().json(json!({ "api_key": payload.identifier }));
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };
}

/// Updates the app_id for the authenticated user.
///
/// # Description
/// Changes the app_id associated with the user's account.
///
/// # Route
/// `PUT v1/users/update_app_id`
///
/// # Request Body
/// ```json
/// {
///   "app_id": 1002
/// }
/// ```
///
/// # Returns
/// - 200 OK with success message
/// - 500 Internal Server Error if update fails

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
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let query = db::controllers::users::update_app_id(&mut connection, &user, payload.app_id).await;

    match query {
        Ok(_) => HttpResponse::Ok().json(json!({ "message": "App ID updated" })),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

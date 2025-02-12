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
/// Database models and schema definitions
use db::{
    models::{
        api::{ApiKey, ApiKeyCreate},
        user_model::{User, UserCreate},
    },
    schema::{api_keys::dsl::*, users::dsl::*},
};
/// Database and async connection handling
use diesel::{prelude::*, result::Error};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection, RunQueryDsl};
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
    let results = users
        .limit(final_limit)
        .select(User::as_select())
        .load(&mut *connection)
        .await
        .expect("Error loading users");

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

    handle_getuser_query(&mut connection, user_email).await
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
    let username = match &payload.name {
        Some(val) => val.clone(),
        None => user.split('@').next().unwrap_or("").to_string(),
    };

    let tx = diesel::insert_into(users)
        .values(UserCreate {
            id: user,
            name: username.clone(),
            app_id: payload.app_id,
        })
        .execute(&mut *connection)
        .await;

    match tx {
        Ok(_) => HttpResponse::Ok().json(json!({ "message": format!("Success: {}", username) })),
        Err(e) => HttpResponse::NotAcceptable().json(json!({ "error": format!("Error: {}", e) })),
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
    let tx = diesel::insert_into(api_keys)
        .values(ApiKeyCreate {
            api_key: hex::encode(hashed_password),
            user_id: user,
            identifier: key[key.len() - 5..].to_string(),
        })
        .execute(&mut *connection)
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

    let query = api_keys
        .filter(user_id.eq(user))
        .select(ApiKey::as_select())
        .load(&mut *connection)
        .await;

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

    let query = diesel::delete(
        api_keys
            .filter(user_id.eq(user))
            .filter(identifier.eq(&payload.identifier)),
    )
    .load::<ApiKey>(&mut *connection)
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

    let query = diesel::update(users)
        .filter(id.eq(user))
        .set(app_id.eq(payload.app_id))
        .execute(&mut *connection)
        .await;

    match query {
        Ok(result) => HttpResponse::Ok().json(format!("Success: {}", result)),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

/// Helper function to retrieve user details by email.
///
/// # Arguments
/// * `connection` - Database connection
/// * `mail` - Email address to look up
///
/// # Returns
/// HttpResponse containing user details or appropriate error

async fn handle_getuser_query(connection: &mut AsyncPgConnection, mail: String) -> HttpResponse {
    match users
        .filter(id.eq(mail))
        .select(User::as_select())
        .first::<User>(connection)
        .await
    {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(Error::NotFound) => HttpResponse::NotFound().body("User not found"),
        Err(_) => HttpResponse::InternalServerError().body("Database error"),
    }
}

/// Checks if a user exists by email address.
///
/// # Arguments
/// * `connection` - Database connection
/// * `user_email` - Email address to check
///
/// # Returns
/// Result containing boolean indicating if user exists

pub async fn user_exists(
    connection: &mut AsyncPgConnection,
    user_email: &str,
) -> Result<bool, Error> {
    diesel::select(diesel::dsl::exists(users.filter(id.eq(user_email))))
        .get_result(connection)
        .await
}

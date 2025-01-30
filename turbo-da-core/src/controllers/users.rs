use crate::{
    config::AppConfig,
    utils::{get_connection, retrieve_email_address, retrieve_user_id},
};
use actix_web::{
    delete, get, post, put,
    web::{self},
    HttpRequest, HttpResponse, Responder,
};
use db::{
    models::{
        api::{ApiKey, ApiKeyCreate},
        user_model::{User, UserCreate},
    },
    schema::{api_keys::dsl::*, users::dsl::*},
};
use diesel::{prelude::*, result::Error};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha3::{Digest, Keccak256};
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Serialize)]
struct GetAllUsersParams {
    limit: Option<i64>,
}

#[derive(Deserialize, Serialize, Validate)]
pub(crate) struct RegisterUser {
    #[validate(length(min = 1))]
    pub name: String,
    pub app_id: i32,
}

#[derive(Deserialize, Serialize, Validate)]
pub(crate) struct UpdateAppID {
    pub app_id: i32,
}

/// Retrieves details about all users.
///
/// # Description
/// This function retrieves a list of user details, with the number of users limited by the `limit` query parameter. The request must be authenticated via a Bearer token.
///
/// # Route
/// `GET /admin/get_all_users`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request.
///
/// # URL Parameters
/// * `limit` (required) - The maximum number of users to retrieve. This parameter controls the pagination of the result set.
///
/// # Returns
/// An `HttpResponse` containing a JSON array of user details. Each user object includes the user's ID, name, email, `app_id`, and assigned wallet. If the request fails or no users are found, an appropriate error response will be returned.
///
/// # Example Request
///
/// ```bash
/// curl -X GET "https://api.example.com/v1/admin/get_all_users?limit=10" \
///      -H "Authorization: Bearer YOUR_TOKEN"
/// ```
///
/// # Example Response
///
/// ```json
/// [
///   {
///     "id": "1",
///     "name": "John Doe",
///     "email": "john@example.com",
///     "app_id": 1001,
///     "assigned_wallet": "0x123abc456def789ghi"
///   },
///   {
///     "id": "2",
///     "name": "Jane Doe",
///     "email": "jane@example.com",
///     "app_id": 1002,
///     "assigned_wallet": "0xabc456def789ghi123"
///   }
/// ]
/// ```

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
/// Retrieves an existing user's details.
///
/// # Description
/// This function retrieves the details of a user based on the provided `name` and `email` in the request body. The request must be authenticated via a Bearer token.
///
/// # Route
/// `POST /users/get_user`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request.
/// * `Content-Type: application/json` - Specifies that the request body is in JSON format.
///
/// # Request Body Parameters
/// * `name` (required) - The name of the user to be retrieved.
/// * `email` (required) - The email address of the user.
///
/// # Returns
/// An `HttpResponse` with the user's details, including their ID, name, email, `app_id`, and assigned wallet, or an error message if the user is not found.
///
/// # Example Request
///
/// ```bash
/// curl -X POST "https://api.example.com/v1/user/get_user" \
///      -H "Authorization: Bearer YOUR_TOKEN" \
///      -H "Content-Type: application/json" \
///      -d '{ "name": "John Doe", "email": "john@example.com" }'
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "id": "1",
///   "name": "John Doe",
///   "email": "john@example.com",
///   "app_id": 1001,
///   "assigned_wallet": "0x123abc456def789ghi"
/// }
/// ```

#[get("/get_user")]
pub async fn get_user(
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user_email = match retrieve_email_address(&http_request) {
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
/// This function handles the registration of a new user by accepting the user's `name` and `app_id` in the request body. It uses the provided authentication token to verify the request and then creates a new user with an assigned wallet.
///
/// # Route
/// `POST /users/register_new_user`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request.
///
/// # Request Body Parameters
/// * `name` - The name of the user to be registered.
/// * `app_id` - The App ID associated with the user on Avail.
///
/// # Returns
/// An `HttpResponse` with the newly created user’s details, including an assigned wallet address, or an error message if registration fails.
///
/// # Example Request
///
/// ```bash
/// curl -X POST "https://api.example.com/v1/users/register_new_user" \
///      -H "Authorization: Bearer YOUR_TOKEN" \
///      -H "Content-Type: application/json" \
///      -d '{ "name": "John Doe", "app_id": 1001 }'
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "id": "1",
///   "name": "John Doe",
///   "email": "john@example.com",
///   "app_id": 1001,
///   "assigned_wallet": "0x123abc456def789ghi"
/// }
/// ```
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

    let mut user_email = match retrieve_email_address(&http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Email not retrieved"),
    };

    if user_exists(&mut connection, user_email.as_mut_str())
        .await
        .is_ok_and(|exists| exists)
    {
        return HttpResponse::Conflict().body("User already exists");
    }

    let user = match retrieve_user_id(http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let tx = diesel::insert_into(users)
        .values(UserCreate {
            id: user,
            name: payload.name.clone(),
            email: user_email.clone(),
            app_id: payload.app_id,
        })
        .execute(&mut *connection)
        .await;

    match tx {
        Ok(_) => HttpResponse::Ok().body(format!("Success: {}", payload.name)),
        Err(e) => HttpResponse::NotAcceptable().body(format!("Error: {}", e)),
    }
}

#[post("/generate_api_key")]
async fn generate_api_key(
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user = match retrieve_user_id(http_request) {
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

#[get("/get_api_key")]
pub async fn get_api_key(
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user = match retrieve_user_id(http_request) {
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

#[derive(Deserialize, Serialize, Validate)]
pub struct DeleteApiKey {
    pub identifier: String,
}

#[delete("/delete_api_key")]
async fn delete_api_key(
    payload: web::Json<DeleteApiKey>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let user = match retrieve_user_id(http_request) {
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
    .execute(&mut *connection)
    .await;

    match query {
        Ok(_) => {
            // TODO: fix known bug. If api gets deleted the Redis cache is not updated.

            return HttpResponse::Ok().json(json!({ "api_key": payload.identifier }));
        }
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };
}

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

    let user = match retrieve_user_id(http_request) {
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

async fn handle_getuser_query(connection: &mut AsyncPgConnection, mail: String) -> HttpResponse {
    match users
        .filter(email.eq(mail))
        .select(User::as_select())
        .first::<User>(connection)
        .await
    {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(Error::NotFound) => HttpResponse::NotFound().body("User not found"),
        Err(_) => HttpResponse::InternalServerError().body("Database error"),
    }
}

pub async fn user_exists(
    connection: &mut AsyncPgConnection,
    user_email: &str,
) -> Result<bool, Error> {
    diesel::select(diesel::dsl::exists(users.filter(email.eq(user_email))))
        .get_result(connection)
        .await
}

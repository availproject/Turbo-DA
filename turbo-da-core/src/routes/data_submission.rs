use crate::{
    config::AppConfig,
    db::{
        customer_expenditure::create_customer_expenditure_entry,
        token_balances::validate_and_get_entries,
    },
    store::CoinGeckoStore,
    utils::{find_key_by_value, format_size, generate_submission_id, map_user_id_to_thread},
    utils::{get_connection, retrieve_user_id},
    workload_scheduler::common::Response,
};
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
use uuid::Uuid;

#[derive(Deserialize, Serialize, Clone)]
pub struct SubmitData {
    pub data: String,
    pub token: String,
}

#[derive(Clone)]
pub struct TxParams {
    pub amount_data: String,
    pub fees: u128,
}

pub struct SpawedThreadParams {
    pub id: Uuid,
    pub user_id: String,
    pub token_details_id: i32,
    pub amount_data: String,
    pub token_address: String,
}

/// Submit data to Avail using a JSON payload.
///
/// # Description
/// This endpoint allows users to submit data to the Avail system along with a token for payment. The data should be provided as a JSON payload, and the associated token is used for processing the payment.
///
/// # Route
/// `POST /user/submit_data`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request. The token should belong to the user making the request.
///
/// # Body Parameters
/// * `data` - The stringified JSON payload that you want to submit. This should contain the data you wish to process.
/// * `token` - The token used to make the payment. This should correspond to a whitelisted token in the system.
///
/// # Returns
/// A JSON object indicating the status of the submission. The response will confirm whether the data was successfully processed or if there were any errors.
///
/// # Example Request
///
/// ```bash
/// curl -X POST "https://api.example.com/v1/user/submit_data" \
///      -H "Authorization: Bearer YOUR_TOKEN" \
///      -H "Content-Type: application/json" \
///      -d '{
///            "data": "Test",
///            "token": "ethereum"
///          }'
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "submission_id": "b9a3f58e-0f49-4e3b-9466-f28d73d75e0a"
/// }
/// ```

#[post("/submit_data")]
pub async fn submit_data(
    request_payload: web::Json<SubmitData>,
    sender: web::Data<Sender<Response>>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
    http_request: HttpRequest,
    store: web::Data<CoinGeckoStore>,
) -> impl Responder {
    let user = match retrieve_user_id(http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let token_addr = match find_key_by_value(&request_payload.token) {
        Some(val) => val,
        None => return HttpResponse::BadRequest().body("Invalid token passed".to_string()),
    };
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let (avail_app_id, token_id) =
        match validate_and_get_entries(&mut connection, &user, token_addr).await {
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
        token_id,
        submission_id,
        user_id: user.clone(),
        app_id: avail_app_id,
        store: store.clone(),
        token_name: request_payload.token.clone(),
    };

    let expenditure_entry = CreateCustomerExpenditure {
        amount_data: format_size(request_payload.data.as_bytes().len()),
        user_id: user,
        id: submission_id,
        token_details_id: token_id,
        error: None,
        payload: Some(request_payload.data.as_bytes().to_vec()),
        payment_token: request_payload.token.clone(),
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

#[derive(Deserialize)]
struct Info {
    token: String,
}

/// Submit raw byte data to Avail.
///
/// # Description
/// This endpoint allows users to submit raw byte data to the Avail system. The byte data is sent in the request body and the associated token is specified as a URL parameter.
///
/// # Route
/// `POST /user/submit_raw_data`
///
/// # Headers
/// * `Authorization: Bearer <token>` - A Bearer token for authenticating the request. This token must belong to the user making the request.
///
/// # URL Parameters
/// * `token` - The name of the token, as determined by the `token_map` endpoint. This token is used to process the payment.
///
/// # Body Parameters
/// * The body of the request should contain the raw byte data that you want to submit. The data should be formatted as a byte string.
///
/// # Returns
/// A JSON object indicating the status of the data submission. The response will provide information about whether the submission was successful or if any errors occurred.
///
/// # Example Request
///
/// ```bash
/// curl -X POST "https://api.example.com/v1/user/submit_raw_data?token=ethereum" \
///      -H "Authorization: Bearer YOUR_TOKEN" \
///      -H "Content-Type: application/json" \
///      -d '011010101010101010100101'
/// ```
///
/// # Example Response
///
/// ```json
/// {
///   "submission_id": "b9a3f58e-0f49-4e3b-9466-f28d73d75e0a"
/// }
/// ```

#[post("/submit_raw_data")]
pub async fn submit_raw_data(
    request_payload: Bytes,
    sender: web::Data<Sender<Response>>,
    query: web::Query<Info>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
    http_request: HttpRequest,
    store: web::Data<CoinGeckoStore>,
) -> impl Responder {
    let user = match retrieve_user_id(http_request) {
        Some(val) => val,
        None => return HttpResponse::InternalServerError().body("User Id not retrieved"),
    };

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let token_addr = match find_key_by_value(&query.token) {
        Some(val) => val,
        None => return HttpResponse::BadRequest().body("Invalid token passed".to_string()),
    };

    let (avail_app_id, token_id) =
        match validate_and_get_entries(&mut connection, &user, token_addr).await {
            Ok(app) => app,
            Err(e) => {
                return HttpResponse::InternalServerError().body(e);
            }
        };

    drop(connection);

    let submission_id = generate_submission_id();

    let expenditure_entry = CreateCustomerExpenditure {
        amount_data: format_size(request_payload.len()),
        user_id: user.clone(),
        id: submission_id,
        token_details_id: token_id,
        error: None,
        payload: Some(request_payload.to_vec()),
        payment_token: query.token.clone(),
    };

    let response = Response {
        thread_id: map_user_id_to_thread(&config),
        raw_payload: request_payload,
        token_id,
        submission_id,
        user_id: user,
        app_id: avail_app_id,
        store: store.clone(),
        token_name: query.token.clone(),
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

use actix_web::{
    get,
    web::{self},
    HttpResponse, Responder,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde_json::json;

use crate::utils::get_connection;
#[get("/indexer_status")]
pub async fn indexer_status(
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
) -> impl Responder {
    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let data = db::controllers::misc::indexer_status(&mut connection).await;
    match data {
        Ok(data) => HttpResponse::Ok().json(json!({"state": "SUCCESS", "message": "Indexer values fetched successfully", "data": data})),
        Err(e) => HttpResponse::InternalServerError().json(json!({"state": "ERROR", "message": e})),
    }
}

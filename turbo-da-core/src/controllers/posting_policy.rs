/// Controls which Avail app ids an application may post under, and whether the
/// caller is allowed to pick one per submission.
use crate::{
    config::AppConfig,
    utils::{get_connection, retrieve_user_id_from_jwt},
};
use actix_web::{get, put, web, HttpRequest, HttpResponse, Responder};
use avail_utils::utils::check_app_id_validity;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

/// Request payload for replacing an app's posting policy
#[derive(Deserialize, Serialize)]
pub struct SetPostingPolicy {
    pub app_id: Uuid,
    pub per_post_app_id: bool,
    pub allowed_avail_app_ids: Vec<i32>,
}

/// Query parameters for reading an app's posting policy
#[derive(Deserialize, Serialize)]
pub struct GetPostingPolicy {
    pub app_id: Uuid,
}

/// Replace the posting policy for an application
///
/// # Description
/// Every id in `allowed_avail_app_ids` is checked against the Avail chain before
/// anything is written, so a policy can never reference an app id that does not
/// exist on chain.
///
/// # Route
/// `PUT /v1/user/app_posting_policy`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "app_id": "uuid-string",
///   "per_post_app_id": true,
///   "allowed_avail_app_ids": [1, 42]
/// }
/// ```
///
/// # Returns
/// * 200 OK if the policy was stored
/// * 400 Bad Request listing any app ids that do not exist on chain
/// * 404 Not Found if the app does not belong to the user
/// * 502 Bad Gateway if the Avail RPC could not be reached
/// * 500 Internal Server Error if the update fails
#[tracing::instrument(
    skip(payload, http_request, injected_dependency, config),
    fields(
        app_id = %payload.app_id,
        per_post_app_id = payload.per_post_app_id,
        endpoint = "set_app_posting_policy"
    )
)]
#[put("/app_posting_policy")]
pub async fn set_app_posting_policy(
    payload: web::Json<SetPostingPolicy>,
    http_request: HttpRequest,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    config: web::Data<AppConfig>,
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

    let rpc_url = match config.avail_rpc_endpoint.first() {
        Some(url) => url.clone(),
        None => {
            return HttpResponse::BadGateway().json(json!({
                "state": "ERROR",
                "error": "no avail rpc endpoint configured",
            }))
        }
    };

    let mut invalid_ids = Vec::new();
    for avail_app_id in &payload.allowed_avail_app_ids {
        match check_app_id_validity(&rpc_url, *avail_app_id).await {
            Ok(true) => {}
            Ok(false) => invalid_ids.push(*avail_app_id),
            Err(e) => {
                tracing::error!(error = %e, avail_app_id = %avail_app_id, "failed to validate avail app id");
                return HttpResponse::BadGateway().json(json!({
                    "state": "ERROR",
                    "error": format!("could not reach avail rpc to validate app ids: {}", e),
                }));
            }
        }
    }

    if !invalid_ids.is_empty() {
        return HttpResponse::BadRequest().json(json!({
            "state": "ERROR",
            "error": format!("invalid avail app ids: {:?}", invalid_ids),
        }));
    }

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    match db::controllers::posting_policy::set_policy(
        &mut connection,
        &user,
        &payload.app_id,
        payload.per_post_app_id,
        payload.allowed_avail_app_ids.clone(),
    )
    .await
    {
        Ok(()) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "posting policy updated successfully",
            "data": {
                "per_post_app_id": payload.per_post_app_id,
                "allowed_avail_app_ids": payload.allowed_avail_app_ids,
            }
        })),
        Err(diesel::result::Error::NotFound) => HttpResponse::NotFound().json(json!({
            "state": "ERROR",
            "error": "app not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

/// Read the posting policy for an application
///
/// # Route
/// `GET /v1/user/app_posting_policy?app_id=<uuid>`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Returns
/// * 200 OK with `per_post_app_id` and the allowed Avail app ids
/// * 404 Not Found if the app does not belong to the user
/// * 500 Internal Server Error if the lookup fails
#[tracing::instrument(
    skip(query, http_request, injected_dependency),
    fields(app_id = %query.app_id, endpoint = "get_app_posting_policy")
)]
#[get("/app_posting_policy")]
pub async fn get_app_posting_policy(
    query: web::Query<GetPostingPolicy>,
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

    if let Err(e) =
        db::controllers::apps::get_app_by_id(&mut connection, &user, &query.app_id).await
    {
        tracing::warn!(error = %e, app_id = %query.app_id, "app lookup failed for posting policy");
        return HttpResponse::NotFound().json(json!({
            "state": "ERROR",
            "error": "app not found",
        }));
    }

    match db::controllers::posting_policy::get_policy(&mut connection, &query.app_id).await {
        Ok((per_post_app_id, allowed_avail_app_ids)) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "posting policy retrieved successfully",
            "data": {
                "per_post_app_id": per_post_app_id,
                "allowed_avail_app_ids": allowed_avail_app_ids,
            }
        })),
        Err(diesel::result::Error::NotFound) => HttpResponse::NotFound().json(json!({
            "state": "ERROR",
            "error": "app not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

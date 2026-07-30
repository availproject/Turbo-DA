/// Per-user notification thresholds: low balance, projected runway, and failed
/// post alerts. The notifier services read these rows; this module only owns the
/// dashboard-facing read and write.
use crate::utils::{get_connection, retrieve_user_id_from_jwt};
use actix_web::{get, put, web, HttpRequest, HttpResponse, Responder};
use bigdecimal::{BigDecimal, Zero};
use db::models::alert_prefs::UserAlertPrefsUpsert;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Bounds on the runway alert horizon, in days.
const MIN_RUNWAY_DAYS: i32 = 1;
const MAX_RUNWAY_DAYS: i32 = 365;

/// Request payload for updating alert preferences
#[derive(Deserialize, Serialize)]
pub struct UpdateAlertPrefs {
    pub low_balance_enabled: bool,
    pub low_balance_credits: Option<BigDecimal>,
    pub runway_enabled: bool,
    pub runway_days: Option<i32>,
    pub failed_post_enabled: bool,
}

/// Read the authenticated user's alert preferences
///
/// # Description
/// A user who has never saved preferences has no row; the defaults returned
/// here match the disabled state the dashboard renders for that case.
///
/// # Route
/// `GET /v1/user/alert_prefs`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Returns
/// * 200 OK with the stored preferences, or all-disabled defaults
/// * 500 Internal Server Error if the lookup fails
#[tracing::instrument(
    skip(http_request, injected_dependency),
    fields(endpoint = "get_alert_prefs")
)]
#[get("/alert_prefs")]
pub async fn get_alert_prefs(
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

    match db::controllers::alert_prefs::get_prefs(&mut connection, &user).await {
        Ok(Some(prefs)) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "alert preferences retrieved successfully",
            "data": prefs,
        })),
        Ok(None) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "alert preferences retrieved successfully",
            "data": {
                "low_balance_enabled": false,
                "low_balance_credits": null,
                "runway_enabled": false,
                "runway_days": null,
                "failed_post_enabled": false,
            }
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

/// Replace the authenticated user's alert preferences
///
/// # Description
/// An enabled alert must carry the value it triggers on, otherwise the notifier
/// would have nothing to compare against.
///
/// # Route
/// `PUT /v1/user/alert_prefs`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Request Body
/// ```json
/// {
///   "low_balance_enabled": true,
///   "low_balance_credits": "1000",
///   "runway_enabled": true,
///   "runway_days": 7,
///   "failed_post_enabled": false
/// }
/// ```
///
/// # Returns
/// * 200 OK with the stored preferences
/// * 400 Bad Request if a threshold is negative, out of range, or missing while enabled
/// * 500 Internal Server Error if the upsert fails
#[tracing::instrument(
    skip(payload, http_request, injected_dependency),
    fields(
        low_balance_enabled = payload.low_balance_enabled,
        runway_enabled = payload.runway_enabled,
        endpoint = "update_alert_prefs"
    )
)]
#[put("/alert_prefs")]
pub async fn update_alert_prefs(
    payload: web::Json<UpdateAlertPrefs>,
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

    if let Some(credits) = &payload.low_balance_credits {
        if credits < &BigDecimal::zero() {
            return HttpResponse::BadRequest().json(json!({
                "state": "ERROR",
                "error": "low_balance_credits must not be negative",
            }));
        }
    }

    if payload.low_balance_enabled && payload.low_balance_credits.is_none() {
        return HttpResponse::BadRequest().json(json!({
            "state": "ERROR",
            "error": "low_balance_credits is required when low_balance_enabled is true",
        }));
    }

    if let Some(days) = payload.runway_days {
        if !(MIN_RUNWAY_DAYS..=MAX_RUNWAY_DAYS).contains(&days) {
            return HttpResponse::BadRequest().json(json!({
                "state": "ERROR",
                "error": format!(
                    "runway_days must be between {} and {}",
                    MIN_RUNWAY_DAYS, MAX_RUNWAY_DAYS
                ),
            }));
        }
    }

    if payload.runway_enabled && payload.runway_days.is_none() {
        return HttpResponse::BadRequest().json(json!({
            "state": "ERROR",
            "error": "runway_days is required when runway_enabled is true",
        }));
    }

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let prefs = UserAlertPrefsUpsert {
        user_id: user,
        low_balance_enabled: payload.low_balance_enabled,
        low_balance_credits: payload.low_balance_credits.clone(),
        runway_enabled: payload.runway_enabled,
        runway_days: payload.runway_days,
        failed_post_enabled: payload.failed_post_enabled,
    };

    match db::controllers::alert_prefs::upsert_prefs(&mut connection, &prefs).await {
        Ok(updated) => HttpResponse::Ok().json(json!({
            "state": "SUCCESS",
            "message": "alert preferences updated successfully",
            "data": updated,
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

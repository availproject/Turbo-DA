/// Aggregated spend figures and the merged activity feed backing the dashboard
/// overview.
use crate::utils::{get_connection, retrieve_user_id_from_jwt};
use actix_web::{get, web, HttpRequest, HttpResponse, Responder};
use bigdecimal::BigDecimal;
use chrono::NaiveDateTime;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Bounds on the usage summary window, in days.
const DEFAULT_USAGE_DAYS: i32 = 7;
const MIN_USAGE_DAYS: i32 = 1;
const MAX_USAGE_DAYS: i32 = 90;

/// Bounds on a single page of the activity feed.
const DEFAULT_ACTIVITY_LIMIT: i64 = 30;
const MIN_ACTIVITY_LIMIT: i64 = 1;
const MAX_ACTIVITY_LIMIT: i64 = 100;

/// Query parameters for the usage summary
#[derive(Deserialize, Serialize)]
pub struct UsageSummaryQuery {
    pub days: Option<i32>,
}

/// Query parameters for the activity feed
#[derive(Deserialize, Serialize)]
pub struct ActivityQuery {
    /// Comma separated list of `posts` and/or `credits`; both when absent.
    pub kinds: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Summarise the authenticated user's spend over a trailing window
///
/// # Description
/// Returns the total credits burned, the average daily burn over the window, a
/// daily series for charting, and a per-app breakdown.
///
/// # Route
/// `GET /v1/user/usage_summary?days=7`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Query Parameters
/// * `days` - Optional window length, defaults to 7 and is clamped to 1..=90
///
/// # Returns
/// * 200 OK with the aggregated figures
/// * 500 Internal Server Error if the aggregation fails
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "usage summary retrieved successfully",
///   "data": {
///     "spent_credits": "1024",
///     "burn_per_day_avg": "146.28",
///     "per_day": [{ "date": "2026-07-01", "credits": "512" }],
///     "per_app": [{
///       "app_id": "uuid-string",
///       "credits": "512",
///       "last_post_at": "2026-07-01T12:00:00",
///       "failed_posts": 0
///     }]
///   }
/// }
/// ```
#[tracing::instrument(
    skip(query, http_request, injected_dependency),
    fields(days = ?query.days, endpoint = "usage_summary")
)]
#[get("/usage_summary")]
pub async fn usage_summary(
    query: web::Query<UsageSummaryQuery>,
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

    let days = query
        .days
        .unwrap_or(DEFAULT_USAGE_DAYS)
        .clamp(MIN_USAGE_DAYS, MAX_USAGE_DAYS);

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    match db::controllers::customer_expenditure::usage_summary(&mut connection, &user, days).await {
        Ok(summary) => {
            let burn_per_day_avg = &summary.spent_credits / BigDecimal::from(days);

            let per_day: Vec<Value> = summary
                .per_day
                .iter()
                .map(|(date, credits)| {
                    json!({
                        "date": date.format("%Y-%m-%d").to_string(),
                        "credits": credits,
                    })
                })
                .collect();

            let per_app: Vec<Value> = summary
                .per_app
                .iter()
                .map(|app| {
                    json!({
                        "app_id": app.app_id,
                        "credits": app.credits,
                        "last_post_at": app.last_post_at,
                        "failed_posts": app.failed_posts,
                    })
                })
                .collect();

            HttpResponse::Ok().json(json!({
                "state": "SUCCESS",
                "message": "usage summary retrieved successfully",
                "data": {
                    "spent_credits": summary.spent_credits,
                    "burn_per_day_avg": burn_per_day_avg,
                    "per_day": per_day,
                    "per_app": per_app,
                }
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "state": "ERROR",
            "error": e.to_string(),
        })),
    }
}

/// Merged feed of data posts and credit top-ups
///
/// # Description
/// Both sources are paged independently and merge-sorted newest first, so each
/// source is over-fetched to `offset + limit` rows before the merged window is
/// sliced out. That over-fetch grows with `offset`, which is acceptable for a
/// dashboard feed where callers page through the first few hundred rows.
///
/// # Route
/// `GET /v1/user/activity?kinds=posts,credits&limit=30&offset=0`
///
/// # Headers
/// * `Authorization: Bearer <token>` - JWT token for authentication
///
/// # Query Parameters
/// * `kinds` - Optional comma separated `posts` and/or `credits`, defaults to both
/// * `limit` - Optional page size, defaults to 30 and is clamped to 1..=100
/// * `offset` - Optional offset into the merged feed, defaults to 0
///
/// # Returns
/// * 200 OK with the merged items and per-source totals
/// * 400 Bad Request if `kinds` names something other than posts or credits
/// * 500 Internal Server Error if either source fails to load
///
/// # Example Response
/// ```json
/// {
///   "state": "SUCCESS",
///   "message": "activity retrieved successfully",
///   "data": {
///     "items": [
///       {
///         "kind": "post",
///         "at": "2026-07-01T12:00:00",
///         "app_id": "uuid-string",
///         "amount_data": "1024",
///         "fees": "0.05",
///         "block_number": 12345,
///         "error": null,
///         "id": "uuid-string"
///       }
///     ],
///     "total_posts": 1,
///     "total_credits": 0
///   }
/// }
/// ```
#[tracing::instrument(
    skip(query, http_request, injected_dependency),
    fields(kinds = ?query.kinds, limit = ?query.limit, offset = ?query.offset, endpoint = "activity")
)]
#[get("/activity")]
pub async fn activity(
    query: web::Query<ActivityQuery>,
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

    let (include_posts, include_credits) = match &query.kinds {
        None => (true, true),
        Some(raw) => {
            let mut posts = false;
            let mut credits = false;

            for kind in raw.split(',').map(str::trim).filter(|k| !k.is_empty()) {
                match kind {
                    "posts" => posts = true,
                    "credits" => credits = true,
                    other => {
                        return HttpResponse::BadRequest().json(json!({
                            "state": "ERROR",
                            "error": format!("unknown activity kind: {}", other),
                        }))
                    }
                }
            }

            if !posts && !credits {
                (true, true)
            } else {
                (posts, credits)
            }
        }
    };

    let limit = query
        .limit
        .unwrap_or(DEFAULT_ACTIVITY_LIMIT)
        .clamp(MIN_ACTIVITY_LIMIT, MAX_ACTIVITY_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);
    let fetch = offset + limit;

    let mut connection = match get_connection(&injected_dependency).await {
        Ok(conn) => conn,
        Err(response) => return response,
    };

    let mut merged: Vec<(NaiveDateTime, Value)> = Vec::new();
    let mut total_posts = 0i64;
    let mut total_credits = 0i64;

    if include_posts {
        let posts = match db::controllers::customer_expenditure::handle_get_all_expenditure_paged(
            &mut connection,
            &user,
            fetch,
            0,
        )
        .await
        {
            Ok(posts) => posts,
            Err(e) => {
                return HttpResponse::InternalServerError().json(json!({
                    "state": "ERROR",
                    "error": e.to_string(),
                }))
            }
        };

        total_posts = match db::controllers::customer_expenditure::count_all_expenditure(
            &mut connection,
            &user,
        )
        .await
        {
            Ok(count) => count,
            Err(e) => {
                return HttpResponse::InternalServerError().json(json!({
                    "state": "ERROR",
                    "error": e.to_string(),
                }))
            }
        };

        merged.extend(posts.into_iter().map(|post| {
            (
                post.created_at,
                json!({
                    "kind": "post",
                    "at": post.created_at,
                    "app_id": post.app_id,
                    "amount_data": post.amount_data,
                    "fees": post.fees,
                    "block_number": post.block_number,
                    "error": post.error,
                    "id": post.id,
                }),
            )
        }));
    }

    if include_credits {
        let credits = match db::controllers::fund::get_fund_list_paged(
            &mut connection,
            &user,
            fetch,
            0,
        )
        .await
        {
            Ok(credits) => credits,
            Err(e) => {
                return HttpResponse::InternalServerError().json(json!({
                    "state": "ERROR",
                    "error": e.to_string(),
                }))
            }
        };

        total_credits = match db::controllers::fund::count_fund_list(&mut connection, &user).await {
            Ok(count) => count,
            Err(e) => {
                return HttpResponse::InternalServerError().json(json!({
                    "state": "ERROR",
                    "error": e.to_string(),
                }))
            }
        };

        merged.extend(credits.into_iter().map(|credit| {
            (
                credit.created_at,
                json!({
                    "kind": "top_up",
                    "at": credit.created_at,
                    "amount_paid": credit.amount_paid,
                    "token_address": credit.token_address,
                    "amount_credit": credit.amount_credit,
                    "tx_hash": credit.tx_hash,
                    "request_status": credit.request_status,
                    "chain_id": credit.chain_id,
                    "id": credit.id,
                }),
            )
        }));
    }

    merged.sort_by(|a, b| b.0.cmp(&a.0));

    let items: Vec<Value> = merged
        .into_iter()
        .skip(offset as usize)
        .take(limit as usize)
        .map(|(_, item)| item)
        .collect();

    HttpResponse::Ok().json(json!({
        "state": "SUCCESS",
        "message": "activity retrieved successfully",
        "data": {
            "items": items,
            "total_posts": total_posts,
            "total_credits": total_credits,
        }
    }))
}

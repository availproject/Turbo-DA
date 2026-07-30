use crate::redis::Redis;
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    error as actix_error,
    http::header::HeaderMap,
    Error,
};
use db::{
    models::api::ApiKey,
    schema::api_keys::{self, dsl::*},
};
use diesel::prelude::*;
use diesel::QueryDsl;
use futures_util::future::LocalBoxFuture;
use sha3::{Digest, Keccak256};
use std::{
    fmt::Display,
    future::{ready, Ready},
};
use turbo_da_core::sanitize::Sanitized;

pub struct Auth {
    redis: Redis,
    database_url: String,
}

impl Auth {
    pub fn new(redis: Redis, database_url: String) -> Self {
        Auth {
            redis,
            database_url,
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for Auth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddleware {
            service,
            redis: self.redis.clone(),
            database_url: self.database_url.clone(),
        }))
    }
}

pub struct AuthMiddleware<S> {
    service: S,
    redis: Redis,
    database_url: String,
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, mut req: ServiceRequest) -> Self::Future {
        let auth_header = req.headers().get("X-API-KEY");
        if auth_header.is_none() {
            return Box::pin(async move { Err(actix_error::ErrorUnauthorized("Missing API key")) });
        }

        let x_api_key = auth_header.unwrap().to_str().unwrap();

        let mut hasher = Keccak256::new();
        hasher.update(x_api_key.as_bytes());
        let api_key_hash = hex::encode(hasher.finalize());
        let mut headers = req.headers_mut();
        // 1. Check if there is any entry in redis for the api key => don't make a call to db
        let redis_search = self.redis.get(api_key_hash.as_str());

        match redis_search {
            Ok(value) => {
                let user = value.split(":").next().unwrap();
                let account = value.split(":").nth(1).unwrap();

                tracing::debug!(
                    user_id = user,
                    app_id = account,
                    api_key_prefix = %Sanitized::api_key(&api_key_hash),
                    "api key authenticated from cache"
                );

                if let Err(e) = insert_headers(&mut headers, "user_id", &user) {
                    return e;
                }
                if let Err(e) = insert_headers(&mut headers, "app_id", &account) {
                    return e;
                }

                // Cache hit means no sync connection is open on this path, so the
                // stamp is pushed off the request thread entirely.
                if should_stamp_last_used(&self.redis, &api_key_hash) {
                    let database_url = self.database_url.clone();
                    let hash = api_key_hash.clone();
                    actix_web::rt::task::spawn_blocking(move || {
                        match PgConnection::establish(&database_url) {
                            Ok(mut conn) => stamp_last_used(&mut conn, &hash),
                            Err(e) => tracing::warn!(
                                error = %e,
                                "failed to connect to database to stamp last_used_at"
                            ),
                        }
                    });
                }
            }
            Err(_) => {
                let mut conn = match PgConnection::establish(&self.database_url) {
                    Ok(conn) => conn,
                    Err(e) => {
                        tracing::error!(error = %e, "failed to connect to database for auth");
                        return Box::pin(async move {
                            Err(actix_error::ErrorInternalServerError(
                                "Internal error. Contact admin",
                            ))
                        });
                    }
                };

                // 2. If there is no entry in redis, make a call to db and update redis
                let api_key_info = api_keys
                    .filter(api_keys::api_key.eq(api_key_hash.as_str()))
                    .select(ApiKey::as_select())
                    .first::<ApiKey>(&mut conn);

                match api_key_info {
                    Err(e) => {
                        tracing::warn!(
                            api_key_prefix = %Sanitized::api_key(&api_key_hash),
                            error = %e,
                            "invalid api key authentication attempt"
                        );
                        return Box::pin(async move {
                            Err(actix_error::ErrorUnauthorized(
                                "Invalid API key: API Key does not exist",
                            ))
                        });
                    }
                    Ok(key) => {
                        if let Err(e) = insert_headers(&mut headers, "user_id", &key.user_id) {
                            return e;
                        }
                        if let Err(e) = insert_headers(&mut headers, "app_id", &key.app_id) {
                            return e;
                        }

                        tracing::info!(
                            user_id = %key.user_id,
                            app_id = %key.app_id,
                            api_key_prefix = %Sanitized::api_key(&api_key_hash),
                            "api key authenticated from database"
                        );

                        match self.redis.set(
                            api_key_hash.as_str(),
                            format!("{}:{}", key.user_id.to_string(), key.app_id.to_string())
                                .as_str(),
                        ) {
                            Ok(_) => {
                                tracing::debug!(
                                    user_id = %key.user_id,
                                    app_id = %key.app_id,
                                    "api key cached in redis"
                                );
                            }
                            Err(e) => {
                                tracing::warn!(
                                    error = %e,
                                    user_id = %key.user_id,
                                    app_id = %key.app_id,
                                    "failed to cache api key in redis"
                                );
                            }
                        }

                        // This path already holds a sync connection, so reuse it
                        // rather than paying for a second one.
                        if should_stamp_last_used(&self.redis, &api_key_hash) {
                            stamp_last_used(&mut conn, &api_key_hash);
                        }
                    }
                }
            }
        }

        let fut = self.service.call(req);

        Box::pin(async move {
            let res = fut.await?;
            Ok(res)
        })
    }
}

/// How long a stamped api key is left alone before its `last_used_at` is written again.
const LAST_USED_THROTTLE_SECS: u64 = 60;

/// Reports whether `last_used_at` should be written for this key, claiming the
/// throttle window when it says yes. Stamping is best effort: a Redis failure
/// means the request proceeds unstamped rather than failing.
fn should_stamp_last_used(redis: &Redis, api_key_hash: &str) -> bool {
    let throttle_key = format!("last_used:{}", api_key_hash);
    if redis.get(&throttle_key).is_ok() {
        return false;
    }

    match redis.set_ex(&throttle_key, "1", LAST_USED_THROTTLE_SECS) {
        Ok(_) => true,
        Err(e) => {
            tracing::warn!(
                error = %e,
                api_key_prefix = %Sanitized::api_key(api_key_hash),
                "failed to claim last_used throttle window; skipping stamp"
            );
            false
        }
    }
}

fn stamp_last_used(conn: &mut PgConnection, api_key_hash: &str) {
    match diesel::update(api_keys.filter(api_keys::api_key.eq(api_key_hash)))
        .set(api_keys::last_used_at.eq(diesel::dsl::now))
        .execute(conn)
    {
        Ok(_) => {
            tracing::debug!(
                api_key_prefix = %Sanitized::api_key(api_key_hash),
                "stamped api key last_used_at"
            );
        }
        Err(e) => {
            tracing::warn!(
                error = %e,
                api_key_prefix = %Sanitized::api_key(api_key_hash),
                "failed to stamp api key last_used_at"
            );
        }
    }
}

fn insert_headers<B, T: Display>(
    headers: &mut HeaderMap,
    key: &str,
    value: &T,
) -> Result<(), LocalBoxFuture<'static, Result<ServiceResponse<B>, Error>>> {
    if let (Ok(parsed_key), Ok(parsed_value)) = (
        key.parse::<actix_web::http::header::HeaderName>(),
        value
            .to_string()
            .parse::<actix_web::http::header::HeaderValue>(),
    ) {
        headers.insert(parsed_key, parsed_value);
        Ok(())
    } else {
        let error_message = format!("Failed to parse {} or its value", key);
        tracing::warn!(header_key = key, "failed to parse header");
        Err(Box::pin(async move {
            Err(actix_error::ErrorInternalServerError(error_message))
        }))
    }
}

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
use log::{debug, error, info};
use sha3::{Digest, Keccak256};
use std::{
    fmt::Display,
    future::{ready, Ready},
};

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

                if let Err(e) = insert_headers(&mut headers, "user_id", &user) {
                    return e;
                }
                if let Err(e) = insert_headers(&mut headers, "app_id", &account) {
                    return e;
                }
            }
            Err(_) => {
                let mut conn = match PgConnection::establish(&self.database_url) {
                    Ok(conn) => conn,
                    Err(e) => {
                        error!("Failed to connect to database: {}", e);
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
                    Err(_) => {
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

                        println!(
                            "Setting API key in redis for user {}:{}",
                            key.user_id, key.app_id
                        );
                        match self.redis.set(
                            api_key_hash.as_str(),
                            format!("{}:{}", key.user_id.to_string(), key.app_id.to_string())
                                .as_str(),
                        ) {
                            Ok(_) => {
                                info!(
                                    "API key set in redis for user {}:{}",
                                    key.user_id, key.app_id
                                );
                            }
                            Err(e) => {
                                error!("Failed to set API key in redis: {}", e);
                            }
                        }
                    }
                }
            }
        }

        let fut = self.service.call(req);

        Box::pin(async move {
            let res = fut.await?;

            debug!("API key {} is valid", api_key_hash);
            Ok(res)
        })
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
        log::warn!("{}", error_message);
        Err(Box::pin(async move {
            Err(actix_error::ErrorInternalServerError(error_message))
        }))
    }
}

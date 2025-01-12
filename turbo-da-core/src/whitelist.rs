use crate::auth::{Claims, JWT_SECRET};
/// Auth Module
/// Defined the two roles: member and admin
/// Verifies Clerk JWT using clerk's public key
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    error as actix_error,
    http::header::{HeaderMap, AUTHORIZATION},
    Error,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use lazy_static::lazy_static;
use log::{error, warn};
use std::{
    fs::File,
    future::ready,
    future::{Future, Ready},
    pin::Pin,
};

lazy_static! {
    static ref WHITELIST: Vec<String> = {
        let path = "whitelist.json";
        let file = File::open(path).expect("Failed to open whitelist file");
        let whitelist: Vec<String> =
            serde_json::from_reader(file).expect("Failed to parse whitelist JSON");
        println!("Whitelist: {:?}", whitelist);
        whitelist
    };
}

pub struct WhitelistMiddleware {
    list: Vec<String>,
}

impl WhitelistMiddleware {
    pub fn new() -> Self {
        WhitelistMiddleware {
            list: WHITELIST.clone(),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for WhitelistMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = WhitelistMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(WhitelistMiddlewareService {
            service,
            list: self.list.clone(),
        }))
    }
}

pub struct WhitelistMiddlewareService<S> {
    service: S,
    list: Vec<String>,
}

impl<S, B> Service<ServiceRequest> for WhitelistMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;
    forward_ready!(service);

    fn call(&self, mut req: ServiceRequest) -> Self::Future {
        let headers = req.headers_mut();
        let authorize = authorize(&self.list, headers);

        if let Ok(result) = authorize {
            // Try to insert "user_id" into headers
            if let (Ok(user_id_key), Ok(user_id_value)) = (
                "user_id".parse::<actix_web::http::header::HeaderName>(),
                result.0.parse::<actix_web::http::header::HeaderValue>(),
            ) {
                headers.insert(user_id_key, user_id_value);
            } else {
                warn!("Failed to parse user_id or its value");
                return Box::pin(async move {
                    Err(actix_error::ErrorInternalServerError(
                        "Failed to process user_id",
                    ))
                });
            }

            // Try to insert "user_email" into headers
            if let (Ok(user_email_key), Ok(user_email_value)) = (
                "user_email".parse::<actix_web::http::header::HeaderName>(),
                result.1.parse::<actix_web::http::header::HeaderValue>(),
            ) {
                headers.insert(user_email_key, user_email_value);
            } else {
                warn!("Failed to parse user_email or its value");
                return Box::pin(async move {
                    Err(actix_error::ErrorInternalServerError(
                        "Failed to process user_email",
                    ))
                });
            }
        } else {
            warn!("Authorization failed");
            return Box::pin(async move { Err(actix_error::ErrorUnauthorized("Unauthorized")) });
        }

        let future = self.service.call(req);
        Box::pin(async move {
            match future.await {
                Ok(response) => Ok(response),
                Err(error) => Err(actix_error::ErrorUnauthorized(format!(
                    "Unable to process middleware: {}",
                    error
                ))),
            }
        })
    }
}

fn authorize(whitelist: &[String], headers: &HeaderMap) -> Result<(String, String), String> {
    let auth_header = headers
        .get(AUTHORIZATION)
        .ok_or("Missing Authorization header")?;
    let auth_str = auth_header
        .to_str()
        .map_err(|_| "Invalid Authorization header")?;
    if !auth_str.starts_with("Bearer ") {
        return Err("Invalid Authorization header".to_string());
    }
    let token = &auth_str[7..];

    let decoded = decode::<Claims>(
        token,
        &DecodingKey::from_rsa_pem(JWT_SECRET.as_bytes()).expect("Couldn't decode public key"),
        &Validation::new(Algorithm::RS256),
    )
    .map_err(|_| {
        error!("Couldn't decode token");
        "Couldn't decode token".to_string()
    })?;

    // Check if user email is in whitelist
    if !whitelist.contains(&decoded.claims.user_email) {
        error!("Email not in whitelist: {}", decoded.claims.user_email);
        return Err("Email not in whitelist".to_string());
    }

    Ok((decoded.claims.sub, decoded.claims.user_email))
}

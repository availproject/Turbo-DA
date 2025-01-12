// This file is part of Avail Gas Relay Service.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
use log::error;
use serde::{Deserialize, Serialize};
use std::{
    fmt,
    fs::File,
    future::ready,
    future::{Future, Ready},
    io::Read,
    pin::Pin,
};

lazy_static! {
    pub(crate) static ref JWT_SECRET: String = {
        let path = "public_key.pem";
        let mut file = File::open(path).expect("Failed to open PEM file");
        let mut contents = Vec::new();
        file.read_to_end(&mut contents)
            .expect("Failed to read PEM file");

        String::from_utf8(contents).expect("Failed to convert PEM contents to UTF-8")
    };
}
#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct Claims {
    pub(crate) role: String,
    pub(crate) exp: usize,
    pub(crate) sub: String,
    pub(crate) user_email: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub pw: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Clone, PartialEq)]
pub enum Role {
    User,
    Admin,
}

impl Role {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(role: &str) -> Role {
        match role {
            "admin" => Role::Admin,
            _ => Role::User,
        }
    }
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Role::User => write!(f, "member"),
            Role::Admin => write!(f, "admin"),
        }
    }
}

pub struct AuthMiddleware {
    role: Role,
}

impl AuthMiddleware {
    pub fn new(role: Role) -> Self {
        AuthMiddleware { role }
    }
}

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddlewareService {
            service,
            role: self.role.clone(),
        }))
    }
}

pub struct AuthMiddlewareService<S> {
    service: S,
    role: Role,
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
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
        let role = self.role.clone();
        let headers = req.headers_mut();

        let authorize = authorize(role, headers);

        if let Ok(result) = authorize {
            // Try to insert "user_id" into headers
            if let (Ok(user_id_key), Ok(user_id_value)) = (
                "user_id".parse::<actix_web::http::header::HeaderName>(),
                result.0.parse::<actix_web::http::header::HeaderValue>(),
            ) {
                headers.insert(user_id_key, user_id_value);
            } else {
                log::warn!("Failed to parse user_id or its value");
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
                log::warn!("Failed to parse user_email or its value");
                return Box::pin(async move {
                    Err(actix_error::ErrorInternalServerError(
                        "Failed to process user_email",
                    ))
                });
            }
        } else {
            log::warn!("Authorization failed");
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

fn authorize(role: Role, headers: &HeaderMap) -> Result<(String, String), String> {
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

    match role {
        Role::Admin => {
            if Role::from_str(&decoded.claims.role) != Role::Admin {
                error!("Not an authenticated Admin: {:?}", decoded);
                return Err("Not an authenticated Admin".to_string());
            }
        }
        Role::User => {
            if Role::from_str(&decoded.claims.role) != Role::User {
                error!("Not an authenticated User: {:?}", decoded);
                return Err("Not an authenticated User".to_string());
            }
        }
    }

    Ok((decoded.claims.sub, decoded.claims.user_email))
}

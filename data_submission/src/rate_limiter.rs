use std::time::Duration;

use actix_governor::{
    governor::{clock::QuantaInstant, NotUntil},
    KeyExtractor, SimpleKeyExtractionError,
};
use actix_web::{
    dev::ServiceRequest, http::header::ContentType, HttpResponse, HttpResponseBuilder,
};

use governor::clock::{Clock, DefaultClock};
use sha3::{Digest, Keccak256};

#[derive(Clone)]

pub struct ApiKeyExtractor;

impl KeyExtractor for ApiKeyExtractor {
    type Key = String;
    type KeyExtractionError = SimpleKeyExtractionError<&'static str>;
    fn extract(&self, req: &ServiceRequest) -> Result<Self::Key, Self::KeyExtractionError> {
        let user_agent = req.headers().get("user-agent");
        println!("User-Agent: {:?}", user_agent);
        let auth_header = req.headers().get("X-API-KEY");
        if auth_header.is_none() {
            println!("No API key found in headers");
            return Err(SimpleKeyExtractionError::new("Missing API key"));
        }
        let x_api_key = auth_header.unwrap().to_str().unwrap();
        let mut hasher = Keccak256::new();
        hasher.update(x_api_key.as_bytes());
        let api_key_hash = hex::encode(hasher.finalize());

        Ok(api_key_hash)
    }
    fn exceed_rate_limit_response(
        &self,
        negative: &NotUntil<QuantaInstant>,
        mut response: HttpResponseBuilder,
    ) -> HttpResponse {
        let wait_time = negative
            .wait_time_from(DefaultClock::default().now())
            .as_secs();
        response.content_type(ContentType::json())
            .body(
                format!(
                    r#"{{"code":429, "error": "TooManyRequests", "message": "Too Many Requests", "after": {wait_time}}}"#
                )
            )
    }
}

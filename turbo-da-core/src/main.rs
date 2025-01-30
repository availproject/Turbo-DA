/// Turbo DA is a service which allows customers to submit transaction to Avail using any token.
/// Customer send the money to us in any ERC20 token, and we fund there user account with equivalant avail.
/// Customer then directly sends all the payload, in either JSON format or directly as bytes.
/// The service generates the extrinsic and published it to Avail network.
pub mod auth;
pub mod config;
pub mod controllers;
pub mod db;
pub mod routes;
pub mod store;
pub mod utils;

use crate::controllers::{
    customer_expenditure::{get_all_expenditure, get_submission_info},
    fund::{estimate_credits, estimate_credits_for_bytes, get_token_map, request_funds_status},
    users::{get_all_users, get_user, register_new_user, update_app_id},
};

use actix_cors::Cors;
use actix_extensible_rate_limit::{
    backend::{memory::InMemoryBackend, SimpleInputFunctionBuilder},
    RateLimiter,
};
use actix_web::{
    dev::Service,
    middleware::Logger,
    web::{self},
    App, HttpServer,
};
use auth::AuthMiddleware;
use config::AppConfig;
use tokio::time::Duration;

use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncPgConnection,
};
use log::info;
use routes::health::health_check;

use utils::generate_keygen_list;

#[cfg(feature = "permissioned")]
mod whitelist;
#[cfg(feature = "permissioned")]
use crate::whitelist::WhitelistMiddleware;

#[actix_web::main]
async fn main() -> Result<(), std::io::Error> {
    info!("Starting API server....");

    let app_config = AppConfig::default().load_config()?;

    let db_config =
        AsyncDieselConnectionManager::<AsyncPgConnection>::new(&app_config.database_url);

    let pool: Pool<AsyncPgConnection> = Pool::builder(db_config)
        .max_size(app_config.max_pool_size)
        .build()
        .expect("Failed to create pool");

    let shared_pool = web::Data::new(pool);

    let shared_config = web::Data::new(app_config);

    HttpServer::new(move || {
        let backend = InMemoryBackend::builder().build();
        let input = SimpleInputFunctionBuilder::new(
            Duration::from_secs(shared_config.rate_limit_window_size),
            shared_config.rate_limit_max_requests,
        )
        .custom_key("authorization")
        .build();
        let rate_limiter = RateLimiter::builder(backend.clone(), input)
            .add_headers()
            .build();

        let scope = {
            let base_scope = web::scope("/user").wrap(AuthMiddleware::new(auth::Role::User));

            #[cfg(feature = "permissioned")]
            let base_scope = base_scope.wrap(WhitelistMiddleware::new());

            base_scope
        };

        App::new()
            .wrap_fn(|req, srv| {
                let fut = srv.call(req);
                async move {
                    let mut res = fut.await?;
                    if let (Ok(name), Ok(value)) = (
                        "Content-Security-Policy".parse::<actix_web::http::header::HeaderName>(),
                        "default-src 'self'; script-src 'self'"
                            .parse::<actix_web::http::header::HeaderValue>(),
                    ) {
                        res.headers_mut().insert(name, value);
                    } else {
                        log::warn!("Failed to insert CSP headers");
                    }

                    if let (Ok(name), Ok(value)) = (
                        "X-Content-Type-Options".parse::<actix_web::http::header::HeaderName>(),
                        "nosniff".parse::<actix_web::http::header::HeaderValue>(),
                    ) {
                        res.headers_mut().insert(name, value);
                    } else {
                        log::warn!("Failed to insert X-Content-Type-Options");
                    }

                    Ok(res)
                }
            })
            .wrap(rate_limiter)
            .service(health_check)
            .wrap(Cors::permissive())
            .app_data(shared_config.clone())
            .app_data(shared_pool.clone())
            .wrap(Logger::default())
            .service(
                scope
                    .service(get_user)
                    .service(get_all_expenditure)
                    .service(request_funds_status)
                    .service(register_new_user)
                    .service(get_submission_info)
                    .service(update_app_id)
                    .service(estimate_credits_for_bytes)
                    .service(estimate_credits),
            )
            .service(
                web::scope("/admin")
                    .wrap(AuthMiddleware::new(auth::Role::Admin))
                    .service(get_all_users),
            )
            .service(get_token_map)
    })
    .bind("0.0.0.0:8000")?
    .run()
    .await
}

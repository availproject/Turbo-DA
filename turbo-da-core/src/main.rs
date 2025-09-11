/// Turbo DA is a service which allows customers to submit transaction to Avail using any token.
/// Customer send the money to us in any ERC20 token, and we fund there user account with equivalant avail.
/// Customer then directly sends all the payload, in either JSON format or directly as bytes.
/// The service generates the extrinsic and published it to Avail network.
pub mod config;
pub mod controllers;
pub mod logger;
pub mod routes;
pub mod s3;
pub mod utils;

use crate::controllers::{
    customer_expenditure::get_all_expenditure,
    fund::{
        estimate_credits, estimate_credits_for_bytes, get_all_fund_requests, get_token_map,
        request_funds_status,
    },
    kyc::generate_access_token,
    users::{get_all_users, get_user, register_new_user, update_app_id},
};
use actix_cors::Cors;
use actix_web::{
    dev::Service,
    middleware::Logger,
    web::{self},
    App, HttpMessage, HttpServer,
};
use config::AppConfig;
use controllers::{
    customer_expenditure::{get_expenditure_by_time_range, get_wallet_usage, reset_retry_count},
    file::{download_file, upload_file},
    fund::{
        add_inclusion_details, estimate_credits_against_size, estimate_credits_against_token,
        fund_user, get_fund_list, purchase_cost, register_credit_request,
    },
    misc::indexer_status,
    users::{
        allocate_credit, delete_account, delete_api_key, edit_app_account, generate_api_key,
        generate_app_account, get_all_apps, get_api_keys, get_apps, reclaim_credits,
    },
};

use clerk_rs::{
    clerk::Clerk,
    validators::{actix::ClerkMiddleware, authorizer::ClerkJwt, jwks::MemoryCacheJwksProvider},
    ClerkConfiguration,
};
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncPgConnection,
};
use logger::{info, warn};
use observability::init_tracer;
use routes::health::health_check;

#[actix_web::main]
async fn main() -> Result<(), std::io::Error> {
    info(&"Starting API server....".to_string());

    let app_config = AppConfig::default().load_config()?;
    init_tracer("turbo-da-core");

    let port = app_config.port;
    let db_config =
        AsyncDieselConnectionManager::<AsyncPgConnection>::new(&app_config.database_url);

    let pool: Pool<AsyncPgConnection> = Pool::builder(db_config)
        .max_size(app_config.max_pool_size)
        .build()
        .expect("Failed to create pool");

    let shared_pool = web::Data::new(pool);

    let shared_config = web::Data::new(app_config);

    HttpServer::new(move || {
        let config = ClerkConfiguration::new(
            None,
            None,
            Some(shared_config.clerk_secret_key.clone()),
            None,
        );
        let clerk = Clerk::new(config);

        App::new()
            .service(health_check)
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
                        warn(&"Failed to insert CSP headers".to_string());
                    }

                    if let (Ok(name), Ok(value)) = (
                        "X-Content-Type-Options".parse::<actix_web::http::header::HeaderName>(),
                        "nosniff".parse::<actix_web::http::header::HeaderValue>(),
                    ) {
                        res.headers_mut().insert(name, value);
                    } else {
                        warn(&"Failed to insert X-Content-Type-Options".to_string());
                    }

                    Ok(res)
                }
            })
            .wrap(Cors::permissive())
            .app_data(shared_config.clone())
            .app_data(shared_pool.clone())
            .wrap(Logger::default())
            .service(
                web::scope("/v1")
                    .service(get_token_map)
                    .service(
                        web::scope("/user")
                            .wrap_fn(|req, srv| {
                                let jwt = req.extensions_mut().get::<ClerkJwt>().cloned();
                                let fut = srv.call(req);
                                async move {
                                    let res = fut.await?;
                                    if let Some(jwt) = jwt {
                                        if !jwt.other.get("role").map_or(false, |r| r == "member") {
                                            return Err(actix_web::error::ErrorUnauthorized(
                                                "Unauthorized",
                                            ));
                                        }
                                    } else {
                                        return Err(actix_web::error::ErrorUnauthorized(
                                            "Invalid Authorization header",
                                        ));
                                    }
                                    Ok(res)
                                }
                            })
                            .wrap(ClerkMiddleware::new(
                                MemoryCacheJwksProvider::new(clerk.clone()),
                                None,
                                true,
                            ))
                            .service(get_user)
                            .service(get_all_expenditure)
                            .service(request_funds_status)
                            .service(register_new_user)
                            .service(generate_api_key)
                            .service(delete_api_key)
                            .service(get_api_keys)
                            .service(update_app_id)
                            .service(purchase_cost)
                            .service(estimate_credits_for_bytes)
                            .service(estimate_credits)
                            .service(estimate_credits_against_size)
                            .service(allocate_credit)
                            .service(delete_account)
                            .service(generate_app_account)
                            .service(edit_app_account)
                            .service(register_credit_request)
                            .service(upload_file)
                            .service(download_file)
                            .service(get_expenditure_by_time_range)
                            .service(get_apps)
                            .service(get_fund_list)
                            .service(reclaim_credits)
                            .service(estimate_credits_against_token)
                            .service(add_inclusion_details)
                            .service(get_wallet_usage)
                            .service(generate_access_token),
                    )
                    .service(
                        web::scope("/admin")
                            .wrap_fn(|req, srv| {
                                let jwt = req.extensions_mut().get::<ClerkJwt>().cloned();
                                let fut = srv.call(req);
                                async move {
                                    let res = fut.await?;
                                    if let Some(jwt) = jwt {
                                        if !jwt.other.get("role").map_or(false, |r| r == "admin") {
                                            return Err(actix_web::error::ErrorUnauthorized(
                                                "Unauthorized",
                                            ));
                                        }
                                    } else {
                                        return Err(actix_web::error::ErrorUnauthorized(
                                            "Invalid Authorization header",
                                        ));
                                    }
                                    Ok(res)
                                }
                            })
                            .wrap(ClerkMiddleware::new(
                                MemoryCacheJwksProvider::new(clerk.clone()),
                                None,
                                true,
                            ))
                            .service(get_all_users)
                            .service(get_all_apps)
                            .service(get_all_fund_requests)
                            .service(fund_user)
                            .service(indexer_status)
                            .service(reset_retry_count),
                    ),
            )
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

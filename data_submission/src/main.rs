use crate::redis::Redis;
use actix_cors::Cors;
use actix_extensible_rate_limit::{
    backend::{memory::InMemoryBackend, SimpleInputFunctionBuilder},
    RateLimiter,
};
use actix_web::{
    middleware::Logger,
    web::{self},
    App, HttpServer,
};
use auth::Auth;
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncPgConnection,
};
use log::info;
use routes::{
    data_retrieval::{get_pre_image, get_submission_info},
    data_submission::{submit_data, submit_raw_data},
};
use std::sync::Arc;
use tokio::{sync::broadcast, time::Duration};
use turbo_da_core::{routes::health::health_check, utils::generate_keygen_list};
mod auth;
mod avail;
mod config;
mod db;
mod redis;
mod routes;
mod utils;
mod workload_scheduler;

use config::AppConfig;
use observability::{init_meter, init_tracer};
use workload_scheduler::consumer::Consumer;

#[actix_web::main]
async fn main() -> Result<(), std::io::Error> {
    info!("Starting Data Submission server....");

    init_meter("data_submission");

    let app_config = AppConfig::default().load_config()?;

    let accounts =
        generate_keygen_list(app_config.number_of_threads, &app_config.private_keys).await;
    let shared_keypair = web::Data::new(accounts);

    let db_config =
        AsyncDieselConnectionManager::<AsyncPgConnection>::new(&app_config.database_url);

    let pool: Pool<AsyncPgConnection> = Pool::builder(db_config)
        .max_size(app_config.max_pool_size)
        .build()
        .expect("Failed to create pool");

    let shared_pool = web::Data::new(pool);

    let (sender, _receiver) = broadcast::channel(app_config.broadcast_channel_size);

    let consumer_server = Consumer::new(
        sender.clone(),
        shared_keypair.clone(),
        shared_pool.clone(),
        Arc::new(app_config.avail_rpc_endpoint.clone()),
        app_config.number_of_threads,
    );

    let port = app_config.port;

    let shared_config = web::Data::new(app_config);

    tokio::spawn(async move {
        consumer_server.start_workers().await;
    });

    HttpServer::new(move || {
        let shared_producer_send = web::Data::new(sender.clone());
        let backend = InMemoryBackend::builder().build();
        let input = SimpleInputFunctionBuilder::new(
            Duration::from_secs(shared_config.rate_limit_window_size),
            shared_config.rate_limit_max_requests,
        )
        .custom_key("X-API-KEY")
        .build();
        let rate_limiter = RateLimiter::builder(backend.clone(), input)
            .add_headers()
            .build();

        App::new()
            .wrap(Cors::permissive())
            .wrap(rate_limiter)
            .wrap(Logger::default())
            .service(health_check)
            .service(
                web::scope("/v1")
                    .wrap(Auth::new(
                        Redis::new(shared_config.redis_url.as_str()),
                        shared_config.database_url.clone(),
                    ))
                    .app_data(web::PayloadConfig::new(shared_config.payload_size))
                    .app_data(shared_producer_send.clone())
                    .app_data(shared_config.clone())
                    .app_data(shared_pool.clone())
                    .app_data(shared_keypair.clone())
                    .service(submit_data)
                    .service(submit_raw_data)
                    .service(get_pre_image)
                    .service(get_submission_info),
            )
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

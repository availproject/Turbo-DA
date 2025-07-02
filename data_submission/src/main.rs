use crate::{
    redis::Redis,
    routes::{data_retrieval::decrypt_data, data_submission::submit_data_encrypted},
};
use actix_cors::Cors;

use actix_web::{
    middleware::Logger,
    web::{self},
    App, HttpServer,
};
use auth::Auth;
use config::AppConfig;
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncPgConnection,
};
use observability::{init_meter, init_tracer};
use routes::{
    data_retrieval::{get_pre_image, get_submission_info},
    data_submission::{submit_data, submit_raw_data},
    health::health_check,
};
use std::sync::Arc;
use tokio::sync::broadcast;
use turbo_da_core::{logger::info, utils::generate_keygen_list};
use workload_scheduler::consumer::Consumer;

mod auth;
mod config;
mod redis;
mod routes;
mod utils;
mod workload_scheduler;

#[actix_web::main]
async fn main() -> Result<(), std::io::Error> {
    info(&format!("Starting Data Submission server...."));

    let app_config = AppConfig::default().load_config()?;

    init_meter("data_submission");
    init_tracer("data_submission");

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
        Arc::new(sender.clone()),
        Arc::new(shared_keypair.clone()),
        Arc::new(shared_pool.clone()),
        Arc::new(app_config.avail_rpc_endpoint.clone()),
        app_config.number_of_threads,
    );

    let port = app_config.port;

    let enigma_encryption_service = enigma::EnigmaEncryptionService::new(
        app_config.enigma_encryption_service_url.clone(),
        app_config.enigma_encryption_service_version.clone(),
    );

    let shared_enigma_encryption_service = web::Data::new(enigma_encryption_service);

    let shared_config = web::Data::new(app_config);

    tokio::spawn(async move {
        consumer_server.start_workers().await;
    });

    HttpServer::new(move || {
        let shared_producer_send = web::Data::new(sender.clone());

        App::new()
            .wrap(Cors::permissive())
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
                    .app_data(shared_enigma_encryption_service.clone())
                    .service(submit_data)
                    .service(submit_raw_data)
                    .service(get_pre_image)
                    .service(get_submission_info)
                    .service(submit_data_encrypted)
                    .service(decrypt_data),
            )
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

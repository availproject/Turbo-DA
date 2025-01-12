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

/// Gas Relay is a service which allows customers to submit transaction to Avail using any token.
/// Customer send the money to us in any ERC20 token, and we fund there user account with equivalant avail.
/// Customer then directly sends all the payload, in either JSON format or directly as bytes.
/// The service generates the extrinsic and published it to Avail network.
pub mod auth;
pub mod avail;
pub mod config;
pub mod controllers;
pub mod db;
pub mod routes;
pub mod store;
pub mod utils;
pub mod workload_scheduler;

use crate::{
    controllers::{
        customer_expenditure::{get_all_expenditure, get_submission_info, get_token_expenditure},
        fund::{generate_signature_for_fund_retrieval, get_token_map, request_funds_status},
        token_balances::{
            get_all_tokens, get_all_tokens_with_chain_id, get_token, get_token_using_address,
            register_new_token,
        },
        users::{get_all_users, get_user, register_new_user, update_app_id},
    },
    utils::TOKEN_MAP,
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
use avail_rust::SDK;
use config::AppConfig;
use store::{update_token_prices, CoinGeckoStore};

use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncPgConnection,
};
use log::{error, info};
use routes::{
    data_retrieval::get_pre_image,
    data_submission::{submit_data, submit_raw_data},
    health::health_check,
};
use std::sync::Arc;
use tokio::{
    sync::broadcast,
    time::{sleep, Duration},
};
use utils::generate_keygen_list;
use workload_scheduler::consumer::Consumer;

#[cfg(feature = "permissioned")]
mod whitelist;
#[cfg(feature = "permissioned")]
use crate::whitelist::WhitelistMiddleware;

const WAIT_TIME: u64 = 5;

#[cfg(not(feature = "cron"))]
#[actix_web::main]
async fn main() -> Result<(), std::io::Error> {
    info!("Starting API server....");

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

    tokio::spawn(async move {
        consumer_server.start_workers().await;
    });

    let coin_gecko_store = web::Data::new(CoinGeckoStore::new());

    let coin_gecko_store_copy = coin_gecko_store.clone();
    let app_config_copy = app_config.clone();

    tokio::spawn(async move {
        info!("Running token price update loop....");
        loop {
            update_token_prices(
                app_config_copy.clone(),
                &TOKEN_MAP.keys().cloned().collect::<Vec<String>>(),
                coin_gecko_store_copy.clone(),
            )
            .await;
            sleep(Duration::from_secs(300)).await;
        }
    });

    let payload_size = app_config.payload_size;
    let shared_config = web::Data::new(app_config);

    HttpServer::new(move || {
        let shared_producer_send = web::Data::new(sender.clone());
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
            .app_data(web::PayloadConfig::new(payload_size))
            .app_data(shared_config.clone())
            .app_data(shared_pool.clone())
            .app_data(shared_keypair.clone())
            .app_data(shared_producer_send)
            // .app_data(header.clone())
            // .app_data(limiter.clone())
            .app_data(coin_gecko_store.clone())
            // .wrap(RateLimiter)
            .wrap(Logger::default())
            .service(
                scope
                    .service(get_user)
                    .service(get_all_tokens)
                    .service(get_token)
                    .service(get_token_using_address)
                    .service(get_all_expenditure)
                    .service(get_token_expenditure)
                    .service(submit_data)
                    .service(submit_raw_data)
                    .service(request_funds_status)
                    .service(register_new_token)
                    .service(register_new_user)
                    .service(get_submission_info)
                    .service(get_pre_image)
                    .service(get_all_tokens_with_chain_id)
                    .service(update_app_id)
                    .service(generate_signature_for_fund_retrieval),
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

pub async fn generate_avail_sdk(endpoints: &Arc<Vec<String>>) -> SDK {
    let mut attempts = 0;

    loop {
        if attempts < endpoints.len() {
            attempts = 0;
        }
        let endpoint = &endpoints[attempts];
        info!("Attempting to connect endpoint: {:?}", endpoint);
        match SDK::new(endpoint).await {
            Ok(sdk) => {
                info!("Connected successfully to endpoint: {}", endpoint);

                return sdk;
            }
            Err(e) => {
                error!("Failed to connect to endpoint {}: {:?}", endpoint, e);
                attempts += 1;
            }
        }

        info!("All endpoints failed. Waiting 5 seconds before next retry....");
        sleep(Duration::from_secs(WAIT_TIME)).await;
    }
}

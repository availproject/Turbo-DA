use super::common::Response;
/// A consumer that accepts response through a broadcast channel on the spawned threads.
/// The thread in turn process the request: generate extrinsic and submit it to avail.
/// Records any failure entry.
use crate::redis::Redis;
use actix_web::web;
use avail_rust::Keypair;
use avail_utils::submit_data::SubmitDataAvail;
use bigdecimal::BigDecimal;
use db::{
    controllers::{
        customer_expenditure::{add_error_entry, get_did_fallback_resolved},
        misc::{get_account_by_id, update_database_on_submission},
        users::TxParams,
    },
    errors::*,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use observability::log_txn;
use redis::Commands;
use std::{collections::HashMap, str::FromStr, sync::Arc};
use tokio::{
    sync::broadcast::Sender,
    time::{timeout, Duration},
};
use turbo_da_core::logger::{debug, error, info};
use turbo_da_core::utils::{format_size, generate_avail_sdk, get_connection, Convertor};

pub struct Consumer {
    sender: Arc<Sender<Response>>,
    keypair: Arc<web::Data<Vec<Keypair>>>,
    injected_dependency: Arc<web::Data<Pool<AsyncPgConnection>>>,
    endpoints: Arc<Vec<String>>,
    redis: Arc<Redis>,
    number_of_threads: i32,
}

impl Consumer {
    pub fn new(
        sender: Arc<Sender<Response>>,
        keypair: Arc<web::Data<Vec<Keypair>>>,
        injected_dependency: Arc<web::Data<Pool<AsyncPgConnection>>>,
        endpoints: Arc<Vec<String>>,
        redis: Arc<Redis>,
        number_of_threads: i32,
    ) -> Self {
        Consumer {
            sender,
            keypair,
            injected_dependency,
            endpoints,
            redis,
            number_of_threads,
        }
    }

    pub async fn start_workers(&self) {
        let number_of_threads = self.number_of_threads;
        let (heartbeat_tx, mut heartbeat_rx) =
            tokio::sync::mpsc::channel::<i32>(number_of_threads as usize * 3);

        for i in 0..number_of_threads {
            let injected_dependency = self.injected_dependency.clone();
            let keygen = self.keypair.clone();
            let sender = self.sender.clone();
            let arc_endpoints = self.endpoints.clone();
            let heartbeat_tx = heartbeat_tx.clone();
            let redis = self.redis.clone();

            self.spawn_thread(
                i,
                sender,
                keygen,
                injected_dependency,
                redis,
                arc_endpoints,
                heartbeat_tx,
            )
            .await;
        }

        loop {
            tokio::time::sleep(std::time::Duration::from_secs(300)).await;
            info(&format!(
                "Checking for any threads that are not responding..."
            ));
            let mut active_threads = HashMap::<i32, bool>::new();
            for i in 0..number_of_threads {
                active_threads.insert(i, false);
            }
            while let Ok(thread_id) = heartbeat_rx.try_recv() {
                debug(&format!("Received heartbeat for thread {}", thread_id));
                active_threads.insert(thread_id, true);
            }

            for (thread_id, is_active) in active_threads {
                if !is_active {
                    error(&format!(
                        "Thread {} not responding, restarting...",
                        thread_id
                    ));
                    let injected_dependency = self.injected_dependency.clone();
                    let keygen = self.keypair.clone();
                    let sender = self.sender.clone();
                    let arc_endpoints = self.endpoints.clone();
                    let heartbeat_tx = heartbeat_tx.clone();
                    let redis = self.redis.clone();

                    self.spawn_thread(
                        thread_id,
                        sender,
                        keygen,
                        injected_dependency,
                        redis,
                        arc_endpoints,
                        heartbeat_tx,
                    )
                    .await;
                }
            }
        }
    }

    pub async fn spawn_thread(
        &self,
        i: i32,
        sender: Arc<Sender<Response>>,
        keypair: Arc<web::Data<Vec<Keypair>>>,
        injected_dependency: Arc<web::Data<Pool<AsyncPgConnection>>>,
        redis: Arc<Redis>,

        endpoints: Arc<Vec<String>>,
        heartbeat_tx: tokio::sync::mpsc::Sender<i32>,
    ) {
        std::thread::spawn(move || {
            info(&format!("Spawning thread number {}", i));

            let endpoints = endpoints.clone();

            let runtime = match tokio::runtime::Runtime::new() {
                Ok(runtime) => runtime,
                Err(e) => {
                    error(&format!("Failed to create runtime: {}", e));
                    return;
                }
            };
            let mut receiver = sender.subscribe();
            let injected_dependency = injected_dependency.clone();
            let keygen = keypair.clone();
            let heartbeat_tx = heartbeat_tx.clone();
            runtime.block_on(async move {
                tokio::spawn(async move {
                    info(&format!("Sending heartbeat for thread {}", i));
                    let mut interval = tokio::time::interval(Duration::from_secs(120));
                    loop {
                        interval.tick().await;
                        let _ = heartbeat_tx.send(i).await;
                    }
                });

                while let Ok(response) = receiver.recv().await {
                    if &response.thread_id != &i {
                        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
                        continue;
                    }

                    let result = response_handler(
                        &response,
                        &injected_dependency,
                        &endpoints,
                        &keygen,
                        &redis,
                        i,
                    )
                    .await;

                    if let Err(e) = result {
                        log_txn(&response.submission_id.to_string(), response.thread_id, &e);
                        error(&format!("Failed to process response: {}", e));
                    }

                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            });
        });
    }
}

async fn response_handler(
    response: &Response,
    injected_dependency: &web::Data<Pool<AsyncPgConnection>>,
    endpoints: &Arc<Vec<String>>,
    keygen: &Vec<Keypair>,
    redis: &Arc<Redis>,
    i: i32,
) -> Result<(), String> {
    let mut connection = get_connection(&injected_dependency)
        .await
        .map_err(|_| format!("Failed to get connection"))?;

    let did_fallback_resolved =
        get_did_fallback_resolved(&mut connection, &response.submission_id).await;

    if did_fallback_resolved {
        return Err("Fallback resolved transaction".to_string());
    }

    let sdk = generate_avail_sdk(&endpoints).await;

    info(&format!(
        "Submission Id: {:?} picked up by thread id {:?}",
        response.submission_id, response.thread_id
    ));

    let submit_data_class = SubmitDataAvail::new(&sdk, &keygen[i as usize], response.avail_app_id);

    let mut process_response =
        ProcessSubmitResponse::new(&response, &mut connection, submit_data_class, redis);

    match timeout(
        Duration::from_secs(120),
        process_response.process_response(),
    )
    .await
    {
        Ok(result) => {
            if result.is_err() {
                let err = result.err().unwrap().to_string();
                update_error_entry(response, &mut connection, err.clone()).await;
                return Err(err);
            }
            info(&format!(
                "Successfully submitted response for submission_id {}",
                response.submission_id
            ));
            Ok(())
        }
        Err(_) => {
            update_error_entry(response, &mut connection, TIMEOUT_ERROR.to_string()).await;
            Err(TIMEOUT_ERROR.to_string())
        }
    }
}

struct ProcessSubmitResponse<'a> {
    response: &'a Response,
    connection: &'a mut AsyncPgConnection,
    submit_avail_class: SubmitDataAvail<'a>,
    redis: &'a Arc<Redis>,
}

impl<'a> ProcessSubmitResponse<'a> {
    pub fn new(
        response: &'a Response,
        connection: &'a mut AsyncPgConnection,
        submit_avail_class: SubmitDataAvail<'a>,
        redis: &'a Arc<Redis>,
    ) -> Self {
        Self {
            response,
            connection,
            submit_avail_class,
            redis,
        }
    }

    pub async fn process_response(&mut self) -> Result<&'a Response, String> {
        let (account, user) =
            get_account_by_id(&mut self.connection, &self.response.app_id).await?;

        let data = self.response.raw_payload.clone();

        let convertor = Convertor::new(
            &self.submit_avail_class.client,
            &self.submit_avail_class.account,
        );

        let credits_used = convertor.calculate_credit_utlisation(data.to_vec()).await;

        // blocking code for race condition
        let mut queue = self.redis.redis_pool.get().map_err(|e| e.to_string())?;

        let key = format!(
            "user:{}_main_balance:{}_app_balance:{}",
            account.user_id, account.credit_balance, user.credit_balance
        );

        let member = format!("{}:{}", self.response.submission_id, credits_used);

        let _ = queue
            .rpush::<&str, &str, i64>(&key, &member)
            .map_err(|e| e.to_string())?;

        // error out if balance mismatch
        match account.credit_selection {
            Some(0) => {
                if &credits_used >= &account.credit_balance {
                    return Err("Insufficient assigned credits for user id".to_string());
                }
            }
            Some(1) => {
                if &credits_used >= &user.credit_balance {
                    return Err("Insufficient fallback credits for user id".to_string());
                }
            }
            Some(2) => {
                if &(&credits_used - &account.credit_balance) >= &user.credit_balance {
                    return Err("Insufficient credits for user id".to_string());
                }
            }
            _ => {
                return Err("Invalid credit selection".to_string());
            }
        }

        // Error out if in redis the ordering means this

        // Get all items from the list to check cumulative cost
        let all_items: Vec<String> = queue.lrange(&key, 0, -1).map_err(|e| e.to_string())?;

        debug(&format!("All items: {:?}", all_items));

        let mut cumulative_cost = BigDecimal::from(0);
        for (_, item) in all_items.iter().enumerate() {
            // Parse the cost from "submission_id-cost" format
            let parts: Vec<&str> = item.split(':').collect();

            let submission_id = parts[0];
            if let Ok(cost) = BigDecimal::from_str(parts[1]) {
                cumulative_cost += cost;
            }

            debug(&format!("Cumulative cost: {:?}", cumulative_cost));

            // Check if this is our submission - if so, validate the cumulative cost
            if submission_id == self.response.submission_id.to_string() {
                match account.credit_selection {
                    Some(0) => {
                        if cumulative_cost > account.credit_balance {
                            return Err("Insufficient assigned credits - would exceed balance with pending transactions".to_string());
                        }
                    }
                    Some(1) => {
                        if cumulative_cost > user.credit_balance {
                            return Err("Insufficient fallback credits - would exceed balance with pending transactions".to_string());
                        }
                    }
                    Some(2) => {
                        let total_available = &account.credit_balance + &user.credit_balance;
                        if cumulative_cost > total_available {
                            return Err("Insufficient total credits - would exceed balance with pending transactions".to_string());
                        }
                    }
                    _ => {
                        return Err("Invalid credit selection".to_string());
                    }
                }
                break;
            }
        }

        let result = self.submit_avail_class.submit_data(&data).await?;

        let params = TxParams {
            amount_data: format_size(data.len()),
            amount_data_billed: credits_used,
            fees: result.gas_fee,
        };

        update_database_on_submission(
            self.response.submission_id,
            &mut self.connection,
            result,
            &account,
            params,
        )
        .await?;

        Ok(self.response)
    }
}

async fn update_error_entry(
    response_clone: &Response,
    injected_dependency: &mut AsyncPgConnection,
    err: String,
) {
    add_error_entry(&response_clone.submission_id, err, injected_dependency).await;
}

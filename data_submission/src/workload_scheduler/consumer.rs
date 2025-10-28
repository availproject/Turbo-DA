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
    models::apps::Apps,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use enigma::{
    types::{EncryptRequest, EncryptResponse},
    EnigmaEncryptionService,
};
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
    enigma: Arc<web::Data<EnigmaEncryptionService>>,
    redis: Arc<Redis>,
    number_of_threads: i32,
}

impl Consumer {
    pub fn new(
        sender: Arc<Sender<Response>>,
        keypair: Arc<web::Data<Vec<Keypair>>>,
        injected_dependency: Arc<web::Data<Pool<AsyncPgConnection>>>,
        endpoints: Arc<Vec<String>>,
        enigma: Arc<web::Data<EnigmaEncryptionService>>,
        redis: Arc<Redis>,
        number_of_threads: i32,
    ) -> Self {
        Consumer {
            sender,
            keypair,
            injected_dependency,
            endpoints,
            enigma,
            redis,
            number_of_threads,
        }
    }

    pub async fn start_workers(&self) {
        let number_of_threads = self.number_of_threads;
        let (heartbeat_tx, mut heartbeat_rx) =
            tokio::sync::mpsc::channel::<i32>(number_of_threads as usize * 3);

        for i in 0..number_of_threads {
            self.spawn_thread(i, heartbeat_tx.clone()).await;
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
                    self.spawn_thread(thread_id, heartbeat_tx.clone()).await;
                }
            }
        }
    }

    pub async fn spawn_thread(&self, i: i32, heartbeat_tx: tokio::sync::mpsc::Sender<i32>) {
        let injected_dependency = self.injected_dependency.clone();
        let keygen = self.keypair.clone();
        let sender = self.sender.clone();
        let endpoints = self.endpoints.clone();
        let enigma = self.enigma.clone();
        let redis = self.redis.clone();

        tokio::spawn(async move {
            info(&format!("Spawning thread number {}", i));

            let mut receiver = sender.subscribe();

            tokio::spawn(async move {
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

                let result = Self::response_handler(
                    &response,
                    &injected_dependency,
                    &endpoints,
                    &keygen,
                    &enigma,
                    Arc::clone(&redis),
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
    }

    async fn response_handler(
        response: &Response,
        injected_dependency: &web::Data<Pool<AsyncPgConnection>>,
        endpoints: &Arc<Vec<String>>,
        keygen: &Vec<Keypair>,
        enigma: &EnigmaEncryptionService,
        redis: Arc<Redis>,
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

        let submit_data_class =
            SubmitDataAvail::new(&sdk, &keygen[i as usize], response.avail_app_id);

        let mut process_response = ProcessSubmitResponse::new(
            &response,
            &mut connection,
            submit_data_class,
            enigma,
            redis,
        );

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
}

pub struct ProcessSubmitResponse<'a> {
    response: &'a Response,
    connection: &'a mut AsyncPgConnection,
    submit_avail_class: SubmitDataAvail<'a>,
    enigma: &'a EnigmaEncryptionService,
    redis: Arc<Redis>,
}

impl<'a> ProcessSubmitResponse<'a> {
    pub fn new(
        response: &'a Response,
        connection: &'a mut AsyncPgConnection,
        submit_avail_class: SubmitDataAvail<'a>,
        enigma: &'a EnigmaEncryptionService,
        redis: Arc<Redis>,
    ) -> Self {
        Self {
            response,
            connection,
            submit_avail_class,
            enigma,
            redis,
        }
    }

    pub async fn process_response(&mut self) -> Result<(), String> {
        let (account, user) =
            get_account_by_id(&mut self.connection, &self.response.app_id).await?;

        let (data, encrypted_data) = self.process_data(account.encryption).await?;

        let convertor = Convertor::new(
            &self.submit_avail_class.client,
            &self.submit_avail_class.account,
        );

        let credits_used = convertor.calculate_credit_utlisation(data.to_vec()).await;

        self.validate_balance(
            account.credit_selection,
            &credits_used,
            &account.credit_balance,
            &user.credit_balance,
        )
        .await?;

        self.validate_race_condition(&account, &credits_used, &user.credit_balance)
            .await?;

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
            encrypted_data,
        )
        .await?;

        Ok(())
    }

    async fn process_data(
        &self,
        encryption: bool,
    ) -> Result<(Vec<u8>, Option<EncryptResponse>), String> {
        let data = self.response.raw_payload.clone();

        let encrypted_data = if encryption {
            let encrypt_response = self
                .enigma
                .encrypt(EncryptRequest {
                    plaintext: data.to_vec(),
                    turbo_da_app_id: self.response.app_id,
                })
                .await
                .map_err(|e| e.to_string())?;
            Some(encrypt_response)
        } else {
            None
        };

        let data = if let Some(encrypted_response) = &encrypted_data {
            self.enigma
                .format_encrypt_response_to_data_submission(encrypted_response)
        } else {
            self.response.raw_payload.to_vec()
        };

        Ok((data, encrypted_data))
    }

    async fn validate_balance(
        &self,
        credit_selection: Option<i16>,
        credit_used: &BigDecimal,
        account_credit_balance: &BigDecimal,
        user_credit_balance: &BigDecimal,
    ) -> Result<(), String> {
        match credit_selection {
            Some(0) => {
                if &credit_used >= &account_credit_balance {
                    return Err("Insufficient assigned credits for user id".to_string());
                }
            }
            Some(1) => {
                if &credit_used >= &user_credit_balance {
                    return Err("Insufficient fallback credits for user id".to_string());
                }
            }
            Some(2) => {
                if &(credit_used - account_credit_balance) >= user_credit_balance {
                    return Err("Insufficient credits for user id".to_string());
                }
            }
            _ => {
                return Err("Invalid credit selection".to_string());
            }
        }

        Ok(())
    }

    async fn validate_race_condition(
        &self,
        account: &Apps,
        credits_used: &BigDecimal,
        user_credit_balance: &BigDecimal,
    ) -> Result<(), String> {
        let mut queue = self.redis.redis_pool.get().map_err(|e| e.to_string())?;

        let key = format!(
            "user:{}_main_balance:{}_app_balance:{}",
            account.user_id, account.credit_balance, user_credit_balance
        );

        let member = format!("{}:{}", self.response.submission_id, credits_used);

        let _ = queue
            .rpush::<&str, &str, i64>(&key, &member)
            .map_err(|e| e.to_string())?;

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
                self.validate_balance(
                    account.credit_selection,
                    &cumulative_cost,
                    &account.credit_balance,
                    &user_credit_balance,
                )
                .await?;

                break;
            }
        }

        Ok(())
    }
}

async fn update_error_entry(
    response_clone: &Response,
    injected_dependency: &mut AsyncPgConnection,
    err: String,
) {
    add_error_entry(&response_clone.submission_id, err, injected_dependency).await;
}

/// A consumer that accepts response through a broadcast channel on the spawned threads.
/// The thread in turn process the request: generate extrinsic and submit it to avail.
/// Records any failure entry.
use super::common::Response;
use actix_web::web;
use avail_rust::Keypair;
use avail_utils::submit_data::SubmitDataAvail;
use db::{
    controllers::{
        customer_expenditure::{add_error_entry, get_did_fallback_resolved},
        misc::{get_account_by_id, update_database_on_submission},
        users::TxParams,
    },
    errors::*,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use enigma::{types::EncryptRequest, EnigmaEncryptionService};
use observability::log_txn;
use std::{collections::HashMap, sync::Arc};
use tokio::{
    sync::broadcast::Sender,
    time::{timeout, Duration},
};
use turbo_da_core::logger::{error, info};
use turbo_da_core::utils::{format_size, generate_avail_sdk, get_connection, Convertor};

pub struct Consumer {
    sender: Arc<Sender<Response>>,
    keypair: Arc<web::Data<Vec<Keypair>>>,
    injected_dependency: Arc<web::Data<Pool<AsyncPgConnection>>>,
    endpoints: Arc<Vec<String>>,
    number_of_threads: i32,
    enigma_encryption_service: Arc<web::Data<EnigmaEncryptionService>>,
}

impl Consumer {
    pub fn new(
        sender: Arc<Sender<Response>>,
        keypair: Arc<web::Data<Vec<Keypair>>>,
        injected_dependency: Arc<web::Data<Pool<AsyncPgConnection>>>,
        endpoints: Arc<Vec<String>>,
        number_of_threads: i32,
        enigma_encryption_service: Arc<web::Data<EnigmaEncryptionService>>,
    ) -> Self {
        Consumer {
            sender,
            keypair,
            injected_dependency,
            endpoints,
            number_of_threads,
            enigma_encryption_service,
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
            let enigma_encryption_service = self.enigma_encryption_service.clone();
            let heartbeat_tx = heartbeat_tx.clone();

            self.spawn_thread(
                i,
                sender,
                keygen,
                injected_dependency,
                enigma_encryption_service,
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
                info(&format!("Received heartbeat for thread {}", thread_id));
                active_threads.insert(thread_id, true);
            }

            for (thread_id, is_active) in active_threads {
                if !is_active {
                    error(&format!(
                        "Thread {} not responding, restarting...",
                        thread_id
                    ));
                    let injected_dependency = self.injected_dependency.clone();
                    let enigma_encryption_service = self.enigma_encryption_service.clone();
                    let keygen = self.keypair.clone();
                    let sender = self.sender.clone();
                    let arc_endpoints = self.endpoints.clone();
                    let heartbeat_tx = heartbeat_tx.clone();

                    self.spawn_thread(
                        thread_id,
                        sender,
                        keygen,
                        injected_dependency,
                        enigma_encryption_service,
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
        enigma_encryption_service: Arc<web::Data<EnigmaEncryptionService>>,
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
                        &enigma_encryption_service,
                        &endpoints,
                        &keygen,
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
    enigma_encryption_service: &web::Data<EnigmaEncryptionService>,
    endpoints: &Arc<Vec<String>>,
    keygen: &Vec<Keypair>,
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

    let mut process_response = ProcessSubmitResponse::new(
        &response,
        enigma_encryption_service,
        &mut connection,
        submit_data_class,
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

struct ProcessSubmitResponse<'a> {
    response: &'a Response,
    connection: &'a mut AsyncPgConnection,
    submit_avail_class: SubmitDataAvail<'a>,
    enigma_encryption_service: &'a EnigmaEncryptionService,
}

impl<'a> ProcessSubmitResponse<'a> {
    pub fn new(
        response: &'a Response,
        enigma_encryption_service: &'a EnigmaEncryptionService,
        connection: &'a mut AsyncPgConnection,
        submit_avail_class: SubmitDataAvail<'a>,
    ) -> Self {
        Self {
            response,
            connection,
            enigma_encryption_service,
            submit_avail_class,
        }
    }

    pub async fn process_response(&mut self) -> Result<&'a Response, String> {
        let (account, user) =
            get_account_by_id(&mut self.connection, &self.response.app_id).await?;

        let encrypted_response = if self.response.encrypted {
            let response = self
                .enigma_encryption_service
                .encrypt(EncryptRequest {
                    app_id: self.response.avail_app_id as u32,
                    plaintext: self.response.raw_payload.to_vec(),
                    turbo_da_app_id: self.response.app_id.clone(),
                })
                .await
                .map_err(|e| e.to_string())?;

            Some(response)
        } else {
            None
        };

        let data = if let Some(encrypted_response) = &encrypted_response {
            self.enigma_encryption_service
                .format_encrypt_response_to_data_submission(encrypted_response)
        } else {
            self.response.raw_payload.to_vec()
        };

        let convertor = Convertor::new(
            &self.submit_avail_class.client,
            &self.submit_avail_class.account,
        );

        let credits_used = convertor.calculate_credit_utlisation(data.to_vec()).await;

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
            encrypted_response,
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

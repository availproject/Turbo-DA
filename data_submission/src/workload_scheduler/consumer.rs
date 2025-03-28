/// A consumer that accepts response through a broadcast channel on the spawned threads.
/// The thread in turn process the request: generate extrinsic and submit it to avail.
/// Records any failure entry.
use super::common::Response;
use actix_web::web;
use avail_rust::Keypair;
use bigdecimal::BigDecimal;
use db::{errors::*, models::user_model::User, schema::users::dsl::*};
use diesel::prelude::*;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection, RunQueryDsl};
use log::{error, info};
use std::sync::Arc;
use tokio::{
    sync::broadcast::Sender,
    time::{timeout, Duration},
};
use turbo_da_core::{
    db::customer_expenditure::add_error_entry,
    utils::{format_size, generate_avail_sdk, get_connection, Convertor},
};

use crate::{
    avail::submit_data::{SubmitDataAvail, TransactionInfo},
    db::{
        customer_expenditure::update_customer_expenditure, users::update_credit_balance,
        users::TxParams,
    },
};

pub struct Consumer {
    sender: Sender<Response>,
    keypair: web::Data<Vec<Keypair>>,
    injected_dependency: web::Data<Pool<AsyncPgConnection>>,
    endpoints: Arc<Vec<String>>,
    number_of_threads: i32,
}

impl Consumer {
    pub fn new(
        sender: Sender<Response>,
        keypair: web::Data<Vec<Keypair>>,
        injected_dependency: web::Data<Pool<AsyncPgConnection>>,
        endpoints: Arc<Vec<String>>,
        number_of_threads: i32,
    ) -> Self {
        Consumer {
            sender,
            keypair,
            injected_dependency,
            endpoints,
            number_of_threads,
        }
    }

    pub async fn start_workers(&self) {
        let number_of_threads = self.number_of_threads;

        for i in 0..number_of_threads {
            let injected_dependency = self.injected_dependency.clone();
            let keygen = self.keypair.clone();
            let mut receiver = self.sender.subscribe();

            info!("Spawning thread number {}", i);
            let arc_endpoints = self.endpoints.clone();

            std::thread::spawn(move || {
                let runtime = match tokio::runtime::Runtime::new() {
                    Ok(runtime) => runtime,
                    Err(e) => {
                        error!("Failed to create runtime: {}", e);
                        return;
                    }
                };

                let endpoints = arc_endpoints.clone();

                runtime.block_on(async move {
                    while let Ok(response) = receiver.recv().await {
                        if response.thread_id != i {
                            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
                            continue;
                        }

                        let mut connection = match get_connection(&injected_dependency).await {
                            Ok(conn) => conn,
                            Err(e) => {
                                error!(
                                    "Couldn't establish db connection while processing response: {:?}",
                                    e
                                );
                                return;
                            }
                        };

                        let sdk = generate_avail_sdk(&endpoints).await;

                        info!(
                            "Submission Id: {:?} picked up by thread id {:?}",
                            response.submission_id, response.thread_id
                        );

                        let submit_data_class =
                            SubmitDataAvail::new(&sdk, &keygen[i as usize], response.app_id);

                        let mut process_response = ProcessSubmitResponse::new(
                            &response,
                            &mut connection,
                            submit_data_class,
                        );

                        match timeout(
                            Duration::from_secs(120),
                            process_response.process_response(),
                        )
                        .await
                        {
                            Ok(result) => match result {
                                Ok(response) => {
                                    info!(
                                        "Successfully submitted response for submission_id {}",
                                        response.submission_id
                                    );
                                }
                                Err(e) => {
                                    update_error_entry(response, &mut connection, e.to_string())
                                        .await;
                                    error!("Failed to process the request with error: {:?}", e);
                                }
                            },
                            Err(_) => {
                                update_error_entry(
                                    response,
                                    &mut connection,
                                    TIMEOUT_ERROR.to_string(),
                                )
                                .await;

                                error!("Request processing timed out after 2 minutes");
                            }
                        }
                        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
                    }
                });
            });
        }
    }
}

struct ProcessSubmitResponse<'a> {
    response: &'a Response,
    connection: &'a mut AsyncPgConnection,
    submit_avail_class: SubmitDataAvail<'a>,
}

impl<'a> ProcessSubmitResponse<'a> {
    pub fn new(
        response: &'a Response,
        connection: &'a mut AsyncPgConnection,
        submit_avail_class: SubmitDataAvail<'a>,
    ) -> Self {
        Self {
            response,
            connection,
            submit_avail_class,
        }
    }

    pub async fn process_response(&mut self) -> Result<&'a Response, String> {
        let credit_details = match users
            .filter(db::schema::users::id.eq(&self.response.user_id))
            .select(User::as_select())
            .first::<User>(&mut self.connection)
            .await
        {
            Ok(details) => details,
            Err(e) => {
                error!(
                    "Failed to get user information: {:?} {:?}",
                    self.response.user_id, e
                );
                return Err("INVALID USER".to_string());
            }
        };

        let data = self.response.raw_payload.clone();

        let convertor = Convertor::new(
            &self.submit_avail_class.client,
            &self.submit_avail_class.account,
        );

        let credits_used = convertor.calculate_credit_utlisation(data.to_vec()).await;

        if credits_used > credit_details.credit_balance {
            return Err("Insufficient credits".to_string());
        }

        match self.submit_avail_class.submit_data(&data).await {
            Ok(result) => {
                let params = TxParams {
                    amount_data: format_size(data.len()),
                    amount_data_billed: credits_used,
                    fees: result.gas_fee,
                };

                self.update_database(result, params).await;

                Ok(self.response)
            }
            Err(submit_err) => {
                error!("Failed to submit data to avail: {:?}", submit_err);
                Err(format!("Failed to submit data to avail: {:?}", submit_err))
            }
        }
    }

    pub async fn update_database(&mut self, result: TransactionInfo, tx_params: TxParams) {
        let fees_as_bigdecimal = BigDecimal::from(&tx_params.fees);

        update_customer_expenditure(
            result,
            &fees_as_bigdecimal,
            &tx_params.amount_data_billed,
            self.response.submission_id,
            self.connection,
        )
        .await;
        update_credit_balance(self.connection, &self.response.user_id, &tx_params).await;
    }
}

async fn update_error_entry(
    response_clone: Response,
    injected_dependency: &mut AsyncPgConnection,
    err: String,
) {
    add_error_entry(&response_clone.submission_id, err, injected_dependency).await;
}

/// A consumer that accepts response through a broadcast channel on the spawned threads.
/// The thread in turn process the request: generate extrinsic and submit it to avail.
/// Records any failure entry.
use super::common::Response;
use crate::{
    avail::submit_data::{SubmitDataAvail, TransactionInfo},
    db::customer_expenditure::{add_error_entry, update_customer_expenditure},
    generate_avail_sdk,
    routes::data_submission::TxParams,
    utils::{format_size, get_connection, Convertor},
};
use actix_web::web;
use avail_rust::Keypair;
use bigdecimal::BigDecimal;
use db::{errors::*, models::user_model::User, schema::users::dsl::*};
use diesel::prelude::*;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection, RunQueryDsl};
use log::{debug, error, info};
use std::sync::Arc;
use tokio::{
    sync::broadcast::Sender,
    time::{timeout, Duration},
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

                    while let Ok(response) = receiver.recv().await {
                        if response.thread_id != i {
                            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
                            continue;
                        }

                        let sdk = generate_avail_sdk(&endpoints).await;

                        info!(
                            "Submission Id: {:?} picked up by thread id {:?}",
                            response.submission_id, response.thread_id
                        );

                        let response_clone = response.clone();
                        let submit_data_class =
                            SubmitDataAvail::new(&sdk, &keygen[i as usize], response.app_id);

                        let mut process_response = ProcessSubmitResponse::new(
                            response,
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
                                    update_error_entry(
                                        response_clone,
                                        &mut connection,
                                        e.to_string(),
                                    )
                                    .await;
                                    error!("Failed to process the request with error: {:?}", e);
                                }
                            },
                            Err(_) => {
                                update_error_entry(
                                    response_clone,
                                    &mut connection,
                                    TIMEOUT_ERROR.to_string(),
                                )
                                .await;
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
    response: Response,
    connection: &'a mut AsyncPgConnection,
    submit_avail_class: SubmitDataAvail<'a>,
}

impl<'a> ProcessSubmitResponse<'a> {
    pub fn new(
        response: Response,
        connection: &'a mut AsyncPgConnection,
        submit_avail_class: SubmitDataAvail<'a>,
    ) -> Self {
        Self {
            response,
            connection,
            submit_avail_class,
        }
    }

    pub async fn process_response(&mut self) -> Result<Response, String> {
        let credit_details = match users
            .filter(db::schema::users::id.eq(&self.response.user_id))
            .select(User::as_select())
            .first::<User>(&mut self.connection)
            .await
        {
            Ok(details) => details,
            Err(e) => {
                error!("Failed to get token details: {:?}", e);
                return Err(INVALID_TOKEN_ID.to_string());
            }
        };

        let data = self.response.raw_payload.clone();

        // TODO: Check if user has enough credits, then lock the credits to be used for this transaction and later update the database
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

                Ok(self.response.clone())
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
        self.update_credit_balance(tx_params).await;
    }

    async fn update_credit_balance(&mut self, tx_params: TxParams) {
        let tx = diesel::update(users.find(&self.response.user_id))
            .set((
                credit_balance
                    .eq(db::schema::users::credit_balance - &tx_params.amount_data_billed),
                credit_used.eq(db::schema::users::credit_used + &tx_params.amount_data_billed),
            ))
            .execute(&mut self.connection)
            .await;

        match tx {
            Ok(_) => {
                info!(
                    "Entry updated with credits deduction {:?} ",
                    tx_params.amount_data_billed
                );
            }
            Err(e) => {
                error!(
                    "Couldn't insert update fee information entry for token details id {:?}, fee: {:?}. Error {:?}",
                    self.response.user_id, tx_params.fees, e
                );
            }
        }
    }
}

async fn update_error_entry(
    response_clone: Response,
    injected_dependency: &mut AsyncPgConnection,
    err: String,
) {
    add_error_entry(&response_clone.submission_id, err, injected_dependency).await;

    error!("Request processing timed out after 2 minutes");
}

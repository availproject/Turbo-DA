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

/// A consumer that accepts response through a broadcast channel on the spawned threads.
/// The thread in turn process the request: generate extrinsic and submit it to avail.
/// Records any failure entry.
use super::common::Response;
use crate::{
    avail::submit_data::{SubmitDataAvail, TransactionInfo},
    db::customer_expenditure::{add_error_entry, update_customer_expenditure},
    generate_avail_sdk,
    routes::data_submission::TxParams,
    utils::format_size,
    utils::get_connection,
};
use actix_web::web;
use avail_rust::Keypair;
use bigdecimal::BigDecimal;
use db::{errors::*, schema::token_balances::dsl::*};
use diesel::prelude::*;
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection, RunQueryDsl};
use log::{error, info};
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
        let token_details = match token_balances
            .filter(db::schema::token_balances::token_details_id.eq(self.response.token_id))
            .select(db::models::token_balances::TokenBalances::as_select())
            .first::<db::models::token_balances::TokenBalances>(&mut self.connection)
            .await
        {
            Ok(details) => details,
            Err(e) => {
                error!("Failed to get token details: {:?}", e);
                return Err(INVALID_TOKEN_ID.to_string());
            }
        };

        let data = self.response.raw_payload.clone();

        let token_balance_in_avail = self.response.store.get_avail_price_equivalent_to_token(
            &BigDecimal::from(&token_details.token_balance - token_details.token_used),
            self.response.token_name.as_str(),
        );

        info!("Token balance in Avail: {}", token_balance_in_avail);

        if token_balance_in_avail > self.response.store.one_avail() {
            info!(
                "Balance is sufficient for user_id {}, balance: {}",
                self.response.user_id, token_balance_in_avail
            );
        } else {
            error!("Insufficient balance: {}", token_balance_in_avail);
            return Err(ERROR_INSUFFICIENT_BALANCE.to_string());
        }

        match self.submit_avail_class.submit_data(&data).await {
            Ok(result) => {
                let params = TxParams {
                    amount_data: format_size(data.len()),
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
        info!("Fees as BigDecimal: {}", fees_as_bigdecimal);

        let fees_as_bigdecimal_in_avail = self.response.store.get_token_price_equivalent_to_avail(
            &fees_as_bigdecimal,
            self.response.token_name.as_str(),
        );
        info!("Fees in Avail: {}", fees_as_bigdecimal_in_avail);
        update_customer_expenditure(
            result,
            &fees_as_bigdecimal,
            &fees_as_bigdecimal_in_avail,
            self.response.submission_id,
            self.connection,
        )
        .await;
        self.update_token_balances(tx_params, &fees_as_bigdecimal)
            .await;
    }

    async fn update_token_balances(
        &mut self,
        tx_params: TxParams,
        fees_as_bigdecimal: &BigDecimal,
    ) {
        let tx = diesel::update(token_balances.find(self.response.token_id))
            .set((
                token_balance.eq(db::schema::token_balances::token_balance - fees_as_bigdecimal),
                token_used.eq(db::schema::token_balances::token_used + fees_as_bigdecimal),
            ))
            .execute(&mut self.connection)
            .await;

        match tx {
            Ok(_) => {
                info!("Entry updated with fee deduction {:?} ", tx_params.fees);
            }
            Err(e) => {
                error!(
                    "Couldn't insert update fee information entry for token details id {:?}, fee: {:?}. Error {:?}",
                    self.response.token_id, tx_params.fees, e
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

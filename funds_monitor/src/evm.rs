use std::str::FromStr;

use alloy::{
    primitives::Address,
    providers::{Provider, ProviderBuilder, RootProvider, WsConnect},
    pubsub::PubSubFrontend,
    rpc::types::{Filter, Log},
    sol,
    sol_types::SolEvent,
};
use reqwest::Client;
use turbo_da_core::utils::{get_prices, TOKEN_MAP};

use bigdecimal::BigDecimal;
use db::{
    models::credit_requests::CreditRequests,
    schema::{credit_requests, indexer_block_numbers::dsl::*, users},
};
use diesel::prelude::*;
use hex;
use log::{error, info};

use futures_util::stream::StreamExt;

sol! {
    struct Encoder{bytes userID; address tokenAddress; uint256 amount; address recipient; uint256 nonce;}
}

sol! {
    event Deposit(
        bytes userID,
        address tokenAddress,
        uint256 amount,
        address from
    );

    event Withdrawal(
        bytes userID,
        address tokenAddress,
        uint256 amount,
        address to
    );
}

#[derive(Debug, Clone)]
pub struct Price {
    pub btc: Option<f64>,
    pub btc_market_cap: Option<f64>,
    pub eth: Option<f64>,
    pub usd: Option<f64>,
}

pub(crate) struct EVM {
    provider: RootProvider<PubSubFrontend>,
    database_url: String,
    evm_chain_id: i32,
    contract_address: String,
    finalised_threshold: u64,
    start_block: u64,
    coin_gecho_api_url: String,
    coin_gecho_api_key: String,
}

impl EVM {
    pub async fn new(
        contract_adress: String,
        database_url: String,
        ws_url: String,
        evm_chain_id: i32,
        finalised_threshold: u64,
        start_block: u64,
        coin_gecho_api_url: String,
        coin_gecho_api_key: String,
    ) -> Result<Self, String> {
        info!("Network ws url: {:?}", ws_url);
        let ws = WsConnect::new(ws_url);
        let provider = match ProviderBuilder::new().on_ws(ws).await {
            Ok(p) => p,
            Err(e) => {
                error!("Failed to connect to Turbo DA Contract: {:?}", e);
                return Err(format!("Failed to connect to Turbo DA Contract: {:?}", e));
            }
        };

        Ok(Self {
            provider,
            database_url,
            evm_chain_id,
            contract_address: contract_adress,
            finalised_threshold,
            start_block,
            coin_gecho_api_url,
            coin_gecho_api_key,
        })
    }

    pub async fn monitor_evm_chains(&mut self) {
        info!(
            "Monitor service started for contract_address: {} with threshold: {}",
            self.contract_address, self.finalised_threshold
        );

        let subscription = match self.provider.subscribe_blocks().await {
            Ok(s) => s,
            Err(e) => return error!("{}", e.to_string()),
        };
        let mut _stream = subscription.into_stream();

        while let Some(header) = _stream.next().await {
            info!("header: {:?}", header.number);
            let finalised_block = header.inner.number - self.finalised_threshold;

            self.check_deposits(finalised_block).await;
        }
    }

    async fn check_deposits(&mut self, number: u64) {
        let filter = Filter::new()
            .address(Address::from_str(&self.contract_address).unwrap())
            .event("Deposit(bytes,address,uint256,address)")
            .from_block(self.start_block)
            .to_block(number);

        let logs = match self.provider.get_logs(&filter).await {
            Ok(logs) => logs,
            Err(e) => {
                error!("Failed to get logs: {}", e);
                return;
            }
        };

        self.start_block = number;

        for log in logs {
            info!("Log from our contract: {:?}", log.block_hash);
            let receipt = match self.process_deposit_event(&log) {
                Ok(receipt) => receipt,
                Err(e) => {
                    println!("Failed to process deposit event: {}", e);
                    return;
                }
            };

            let mut connection = match self.establish_connection() {
                Ok(conn) => conn,
                Err(e) => {
                    error!("Failed to establish database connection: {}", e);
                    continue;
                }
            };

            let Some(number) = log.block_number else {
                error!("Block number not found");
                continue;
            };
            let Some(hash) = log.block_hash else {
                error!("Block hash not found");
                continue;
            };

            match self
                .update_finalised_block_number(number as i32, hash.to_string(), &mut connection)
                .await
            {
                Ok(_) => {
                    info!("Updated finalised block number: {}", number);
                }
                Err(e) => {
                    error!("Failed to update finalised block number: {}", e);
                }
            }

            let tx_hash = match log.transaction_hash {
                Some(tx_hash) => tx_hash.to_string(),
                None => {
                    error!("Transaction hash not found");
                    continue;
                }
            };

            self.update_database_on_deposit(
                &receipt,
                &tx_hash,
                &mut connection,
                &"Processed".to_string(),
            )
            .await;
        }
    }

    fn process_deposit_event(&self, log: &Log) -> Result<Deposit, String> {
        let event_receipt = Deposit::decode_log_data(&log.data(), true)
            .map_err(|e| format!("Failed to decode log data: {}", e))?;

        Ok(event_receipt)
    }

    async fn update_token_information_on_deposit(
        &self,
        receipt: &Deposit,
        amount: &BigDecimal,
        connection: &mut PgConnection,
    ) {
        let updated_rows_query =
            diesel::update(users::table.filter(users::id.eq(receipt.userID.to_string())))
                .set(users::credit_balance.eq(users::credit_balance + amount))
                .execute(connection);

        let updated_rows = updated_rows_query.unwrap_or_else(|_| {
            error!("Update token balances query failed");
            0
        });

        if updated_rows > 0 {
            info!(
                "Successfully updated token balances with user ID {} with amount {}",
                receipt.userID, receipt.amount
            );
        } else {
            error!("No rows updated for user ID: {}", receipt.userID);
        }
    }

    async fn update_database_on_deposit(
        &self,
        receipt: &Deposit,
        transaction_hash: &String,
        connection: &mut PgConnection,
        status: &String,
    ) {
        let original_user_id = match receipt.userID.to_string().split("0x").last() {
            Some(hex_str) => match hex::decode(hex_str) {
                Ok(bytes) => bytes,
                Err(e) => {
                    error!("Failed to decode hex string: {}", e);
                    return;
                }
            },
            None => {
                error!("Failed to parse userID - no hex data found after 0x");
                return;
            }
        };
        let user_id_local = String::from_utf8_lossy(&original_user_id).into_owned();
        let address = receipt.tokenAddress.to_string().to_lowercase();
        let amount = match self
            .get_amount_to_be_credited(
                address,
                BigDecimal::from_str(&receipt.amount.to_string().as_str()).unwrap(),
            )
            .await
        {
            Ok(amount) => amount,
            Err(e) => {
                error!("Failed to parse amount: {}", e);
                return;
            }
        };

        let tx = diesel::insert_into(credit_requests::table)
            .values(CreditRequests {
                amount_credit: amount.clone(),
                request_status: status.to_string(),
                user_id: user_id_local.clone(),
                chain_id: Some(self.evm_chain_id),
                tx_hash: Some(transaction_hash.clone()),
                request_type: "DEPOSIT".to_string(),
            })
            .execute(&mut *connection);

        match tx {
            Ok(_) => {
                info!("Success: {} status: {}", user_id_local, status);
                self.update_token_information_on_deposit(&receipt, &amount, connection)
                    .await;
            }
            Err(e) => {
                error!("Couldn't store fund request: {:?}", e);
            }
        }
    }

    async fn update_finalised_block_number(
        &self,
        number: i32,
        hash: String,
        connection: &mut PgConnection,
    ) -> Result<(), String> {
        let row = diesel::update(indexer_block_numbers)
            .set((
                chain_id.eq(self.evm_chain_id),
                block_number.eq(number),
                block_hash.eq(hash),
            ))
            .execute(connection);

        match row {
            Ok(row) => {
                if row > 0 {
                    info!("Updated finalised block number: {}", row);
                    Ok(())
                } else {
                    error!("No rows updated for finalised block number");
                    Err(format!("No rows updated for finalised block number"))
                }
            }
            Err(e) => {
                error!("Failed to update finalised block number: {}", e);
                Err(format!("Failed to update finalised block number: {}", e))
            }
        }
    }

    async fn get_amount_to_be_credited(
        &self,
        address: String,
        amount: BigDecimal,
    ) -> Result<BigDecimal, String> {
        let price = match get_avail_price_equivalent_to_token(
            &self.coin_gecho_api_url,
            &self.coin_gecho_api_key,
            &amount,
            &address,
        )
        .await
        {
            Ok(price) => price,
            Err(e) => {
                error!("Failed to get price for {}: {}", address, e);
                return Err(format!("Failed to get price for {}: {}", address, e));
            }
        };

        Ok(price)
    }

    pub fn establish_connection(&self) -> Result<PgConnection, String> {
        PgConnection::establish(&self.database_url)
            .map_err(|e| format!("Error connecting to {}: {}", self.database_url, e))
    }
}

pub async fn get_avail_price_equivalent_to_token(
    coin_gecho_api_url: &str,
    coin_gecho_api_key: &str,
    amount: &BigDecimal,
    token_address: &str,
) -> Result<BigDecimal, String> {
    let client = Client::new();

    info!("Updating token price for: {}", token_address);
    let token_name = TOKEN_MAP
        .iter()
        .find(|(_, token)| token.token_address == token_address)
        .map(|(key, _)| key.clone())
        .ok_or_else(|| {
            error!("Token not found in TOKEN_MAP");
            String::from("Token not found in TOKEN_MAP")
        })?;

    let (coin_price, avail_price) = match get_prices(
        &client,
        &coin_gecho_api_url,
        &coin_gecho_api_key,
        token_name.as_str(),
    )
    .await
    {
        Ok(prices) => prices,
        Err(e) => {
            error!("Failed to get prices for {}: {}", token_name, e);
            return Err(format!("Failed to get prices for {}: {}", token_name, e));
        }
    };

    info!("New Token price: {}", coin_price);
    info!("New Avail price: {}", avail_price);

    let price = coin_price / avail_price;
    let decimals_token = TOKEN_MAP.get(token_name.as_str()).unwrap().token_decimals;
    let decimals_avail = TOKEN_MAP.get("avail").unwrap().token_decimals;
    let token_price_per_avail_bigdecimal = match BigDecimal::from_str(price.to_string().as_str()) {
        Ok(amount) => amount,
        Err(e) => {
            error!("Failed to parse amount to BigDecimal: {}", e);
            return Err(format!("Failed to parse amount to BigDecimal: {}", e));
        }
    };

    let price = token_price_per_avail_bigdecimal
        * amount
        * BigDecimal::from(10_u64.pow(decimals_avail as u32))
        / BigDecimal::from(10_u64.pow(decimals_token as u32));

    Ok(price.round(0))
}

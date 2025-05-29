use std::str::FromStr;

use bigdecimal::BigDecimal;
use db::{
    models::credit_requests::CreditRequestsGet,
    schema::{credit_requests, indexer_block_numbers::dsl::*, users},
};
use diesel::prelude::*;
use serde_json::json;
use turbo_da_core::logger::{debug_json, error, error_json, info};
use turbo_da_core::utils::get_amount_to_be_credited;

pub struct Deposit {
    pub token_address: String,
    pub amount: String,
    pub _from: String,
}

pub struct Utils {
    coin_gecho_api_url: String,
    coin_gecho_api_key: String,
    database_url: String,
    avail_rpc_url: String,
}

impl Utils {
    pub fn new(
        coin_gecho_api_url: String,
        coin_gecho_api_key: String,
        database_url: String,
        avail_rpc_url: String,
    ) -> Self {
        Self {
            coin_gecho_api_url,
            coin_gecho_api_key,
            database_url,
            avail_rpc_url,
        }
    }

    pub async fn update_database_on_deposit(
        &self,
        order_id: &String,
        receipt: &Deposit,
        transaction_hash: &String,
        connection: &mut PgConnection,
        chain_identifier: i32, // 0 for Avail
        status: &String,
    ) -> Result<(), String> {
        let address = receipt.token_address.to_lowercase();
        let amount = get_amount_to_be_credited(
            &self.coin_gecho_api_url,
            &self.coin_gecho_api_key,
            &self.avail_rpc_url,
            &address,
            &BigDecimal::from_str(&receipt.amount.to_string().as_str()).unwrap(),
        )
        .await
        .map_err(|e| format!("Failed to get amount to be credited: {}", e))?;

        let parsed_id = i32::from_str_radix(order_id.trim_start_matches("0x"), 16)
            .map_err(|e| format!("Failed to parse order ID: {}", e))?;

        debug_json(json!({
            "order_id": order_id,
            "level": "debug"
        }));
        debug_json(json!({
            "parsed_id": parsed_id,
            "level": "debug"
        }));

        let row = diesel::update(credit_requests::table)
            .filter(credit_requests::id.eq(parsed_id))
            .set((
                credit_requests::amount_credit.eq(Some(amount.clone())),
                credit_requests::request_status.eq(status.to_string()),
                credit_requests::chain_id.eq(Some(chain_identifier)),
                credit_requests::tx_hash.eq(Some(transaction_hash.clone())),
                credit_requests::request_type.eq("DEPOSIT".to_string()),
                credit_requests::token_address.eq(Some(address.clone())),
            ))
            .returning(CreditRequestsGet::as_returning())
            .get_result::<CreditRequestsGet>(&mut *connection)
            .map_err(|e| format!("Failed to store fund request: {}", e))?;

        info(&format!("Success: {} status: {}", order_id, status));
        self.update_token_information_on_deposit(&amount, &row.user_id, connection)
            .await;

        Ok(())
    }

    pub async fn update_token_information_on_deposit(
        &self,
        amount: &BigDecimal,
        user_id: &String,
        connection: &mut PgConnection,
    ) {
        let updated_rows_query = diesel::update(users::table.filter(users::id.eq(user_id)))
            .set(users::credit_balance.eq(users::credit_balance + amount))
            .execute(connection);

        let updated_rows = updated_rows_query.unwrap_or_else(|_| {
            error(&format!("Update token balances query failed"));
            0
        });

        if updated_rows > 0 {
            debug_json(json!({
                "message": "Successfully updated token balances",
                "user_id": user_id,
                "amount": amount,
                "level": "debug"
            }));
        } else {
            error_json(json!({
                "message": "No rows updated for user ID",
                "user_id": user_id,
                "level": "error"
            }));
        }
    }

    pub async fn update_finalised_block_number(
        &self,
        number: i32,
        hash: String,
        connection: &mut PgConnection,
        chain_identifier: i32,
    ) -> Result<(), String> {
        let row = diesel::update(indexer_block_numbers)
            .filter(chain_id.eq(chain_identifier))
            .set((block_number.eq(number), block_hash.eq(hash)))
            .execute(connection);

        match row {
            Ok(row) => {
                if row > 0 {
                    debug_json(json!({
                        "message": "Updated finalised block number",
                        "row": row,
                        "level": "debug"
                    }));
                    Ok(())
                } else {
                    Err(format!("No rows updated for finalised block number"))
                }
            }
            Err(e) => Err(format!("Failed to update finalised block number: {}", e)),
        }
    }

    pub fn establish_connection(&self) -> Result<PgConnection, String> {
        PgConnection::establish(&self.database_url)
            .map_err(|e| format!("Error connecting to {}: {}", self.database_url, e))
    }
}

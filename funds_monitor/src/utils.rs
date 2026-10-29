use std::str::FromStr;

use bigdecimal::BigDecimal;
use db::{
    models::credit_requests::CreditRequestsGet,
    schema::{credit_requests, indexer_block_numbers::dsl::*, user_alert_prefs, users},
};
use diesel::prelude::*;

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
            &(chain_identifier as u32),
            &address,
            &BigDecimal::from_str(&receipt.amount.to_string().as_str()).unwrap(),
        )
        .await
        .map_err(|e| format!("Failed to get amount to be credited: {}", e))?;

        let parsed_id = i32::from_str_radix(order_id.trim_start_matches("0x"), 16)
            .map_err(|e| format!("Failed to parse order ID: {}", e))?;

        tracing::debug!(order_id = %order_id, level = "debug");
        tracing::debug!(parsed_id = %parsed_id, level = "debug");

        let row = diesel::update(credit_requests::table)
            .filter(credit_requests::id.eq(parsed_id))
            .filter(credit_requests::amount_credit.is_null())
            .set((
                credit_requests::amount_credit.eq(Some(amount.clone())),
                credit_requests::request_status.eq(status.to_string()),
                credit_requests::chain_id.eq(Some(chain_identifier)),
                credit_requests::tx_hash.eq(Some(transaction_hash.clone())),
                credit_requests::request_type.eq("DEPOSIT".to_string()),
                credit_requests::token_address.eq(Some(address.clone())),
                credit_requests::amount_paid.eq(Some(
                    BigDecimal::from_str(&receipt.amount.to_string().as_str()).unwrap(),
                )),
            ))
            .returning(CreditRequestsGet::as_returning())
            .get_result::<CreditRequestsGet>(&mut *connection)
            .map_err(|e| format!("Failed to store fund request: {}", e))?;

        tracing::info!(order_id = %order_id, status = %status, "success");
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
            .returning(users::credit_balance)
            .get_results::<BigDecimal>(connection);

        let updated_balances = updated_rows_query.unwrap_or_else(|_| {
            tracing::error!("update token balances query failed");
            Vec::new()
        });

        if let Some(new_balance) = updated_balances.first() {
            tracing::debug!(
                message = "successfully updated token balances",
                user_id = %user_id,
                amount = %amount,
                level = "debug"
            );
            self.rearm_low_balance_alert(user_id, new_balance, connection);
        } else {
            tracing::error!(
                message = "no rows updated for user id",
                user_id = %user_id,
                level = "error"
            );
        }
    }

    /// Re-arms the low balance alert once a deposit puts the account back above
    /// the user's threshold.
    ///
    /// data_submission latches `low_balance_alerted_at` when it warns, so
    /// without this the user would only ever be told once. Best effort: a
    /// deposit must still be credited if this fails.
    fn rearm_low_balance_alert(
        &self,
        user_id: &String,
        new_balance: &BigDecimal,
        connection: &mut PgConnection,
    ) {
        let cleared = diesel::update(
            user_alert_prefs::table
                .filter(user_alert_prefs::user_id.eq(user_id))
                .filter(user_alert_prefs::low_balance_alerted_at.is_not_null())
                .filter(
                    user_alert_prefs::low_balance_credits
                        .is_null()
                        .or(user_alert_prefs::low_balance_credits.le(new_balance)),
                ),
        )
        .set(user_alert_prefs::low_balance_alerted_at.eq(None::<chrono::NaiveDateTime>))
        .execute(connection);

        match cleared {
            Ok(rows) if rows > 0 => {
                tracing::info!(
                    user_id = %user_id,
                    new_balance = %new_balance,
                    "re-armed low balance alert after deposit"
                );
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    user_id = %user_id,
                    "couldn't re-arm low balance alert"
                );
            }
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
                    tracing::debug!(
                        message = "updated finalised block number",
                        row = row,
                        level = "debug"
                    );
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

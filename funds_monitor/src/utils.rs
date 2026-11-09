use std::str::FromStr;

use bigdecimal::BigDecimal;
use db::{
    models::credit_requests::CreditRequestsGet,
    schema::{credit_requests, indexer_block_numbers::dsl::*, users},
};
use diesel::prelude::*;

use turbo_da_core::utils::get_amount_to_be_credited;

pub struct Deposit {
    pub token_address: String,
    pub amount: String,
    pub _from: String,
}

/// Values written to the database when a deposit order is credited.
struct DepositCredit<'a> {
    order_id: i32,
    amount: &'a BigDecimal,
    amount_paid: &'a BigDecimal,
    transaction_hash: &'a str,
    token_address: &'a str,
    chain_identifier: i32,
    status: &'a str,
}

/// Records a deposit against its order and credits the user in one transaction.
///
/// The `amount_credit IS NULL` filter is the idempotency guard: the update holds the row lock, so
/// a concurrent or replayed credit matches no row. Rolling back on failure leaves the order
/// uncredited, so a failed deposit can be retried.
fn credit_deposit(connection: &mut PgConnection, credit: &DepositCredit<'_>) -> QueryResult<()> {
    connection.transaction(|connection| {
        let row = diesel::update(credit_requests::table)
            .filter(credit_requests::id.eq(credit.order_id))
            .filter(credit_requests::amount_credit.is_null())
            .set((
                credit_requests::amount_credit.eq(Some(credit.amount.clone())),
                credit_requests::request_status.eq(credit.status.to_string()),
                credit_requests::chain_id.eq(Some(credit.chain_identifier)),
                credit_requests::tx_hash.eq(Some(credit.transaction_hash.to_string())),
                credit_requests::request_type.eq("DEPOSIT".to_string()),
                credit_requests::token_address.eq(Some(credit.token_address.to_string())),
                credit_requests::amount_paid.eq(Some(credit.amount_paid.clone())),
            ))
            .returning(CreditRequestsGet::as_returning())
            .get_result::<CreditRequestsGet>(connection)?;

        diesel::update(users::table.filter(users::id.eq(&row.user_id)))
            .set(users::credit_balance.eq(users::credit_balance + credit.amount))
            .returning(users::id)
            .get_result::<String>(connection)?;

        Ok(())
    })
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
            &BigDecimal::from_str(&receipt.amount)
                .map_err(|e| format!("Failed to parse deposit amount: {}", e))?,
        )
        .await
        .map_err(|e| format!("Failed to get amount to be credited: {}", e))?;

        let parsed_id = i32::from_str_radix(order_id.trim_start_matches("0x"), 16)
            .map_err(|e| format!("Failed to parse order ID: {}", e))?;

        tracing::debug!(order_id = %order_id, level = "debug");
        tracing::debug!(parsed_id = %parsed_id, level = "debug");

        let amount_paid = BigDecimal::from_str(&receipt.amount)
            .map_err(|e| format!("Failed to parse deposit amount: {}", e))?;

        credit_deposit(
            connection,
            &DepositCredit {
                order_id: parsed_id,
                amount: &amount,
                amount_paid: &amount_paid,
                transaction_hash,
                token_address: &address,
                chain_identifier,
                status,
            },
        )
        .map_err(|e| format!("Failed to store fund request: {}", e))?;

        tracing::info!(order_id = %order_id, status = %status, "success");

        Ok(())
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

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU32, Ordering};

    use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

    use super::*;

    const MIGRATIONS: EmbeddedMigrations = embed_migrations!("../db/migrations");
    const USER_ID: &str = "depositor@example.com";
    static NEXT_DATABASE: AtomicU32 = AtomicU32::new(0);

    /// Disposable migrated database, following the convention of `TestDB` in turbo-da-core.
    struct TestDatabase {
        admin_url: String,
        name: String,
        connection: PgConnection,
    }

    impl TestDatabase {
        fn new() -> Self {
            let admin_url =
                std::env::var("DATABASE_URL_TEST").expect("DATABASE_URL_TEST must be set");
            let name = format!(
                "test_funds_monitor_{}_{}",
                std::process::id(),
                NEXT_DATABASE.fetch_add(1, Ordering::Relaxed)
            );
            let mut admin = PgConnection::establish(&admin_url).expect("connect to admin database");
            diesel::sql_query(format!("CREATE DATABASE {name}"))
                .execute(&mut admin)
                .expect("create test database");

            let mut connection = PgConnection::establish(&format!("{admin_url}/{name}"))
                .expect("connect to test database");
            connection
                .run_pending_migrations(MIGRATIONS)
                .expect("run migrations");

            Self {
                admin_url,
                name,
                connection,
            }
        }

        /// Inserts a user with no credit and one pending order, returning the order id.
        fn seed_pending_order(&mut self) -> i32 {
            diesel::insert_into(users::table)
                .values((users::id.eq(USER_ID), users::name.eq("Depositor")))
                .execute(&mut self.connection)
                .expect("insert user");

            diesel::insert_into(credit_requests::table)
                .values((
                    credit_requests::user_id.eq(USER_ID),
                    credit_requests::request_status.eq("PENDING"),
                    credit_requests::request_type.eq("DEPOSIT"),
                ))
                .returning(credit_requests::id)
                .get_result(&mut self.connection)
                .expect("insert credit request")
        }

        fn credit(&mut self, order_id: i32) -> QueryResult<()> {
            let amount = BigDecimal::from(1000);
            credit_deposit(
                &mut self.connection,
                &DepositCredit {
                    order_id,
                    amount: &amount,
                    amount_paid: &amount,
                    transaction_hash: "0xabc",
                    token_address: "0x0000000000000000000000000000000000000000",
                    chain_identifier: 0,
                    status: "PROCESSED",
                },
            )
        }

        fn order_state(&mut self, order_id: i32) -> (Option<BigDecimal>, String) {
            credit_requests::table
                .filter(credit_requests::id.eq(order_id))
                .select((
                    credit_requests::amount_credit,
                    credit_requests::request_status,
                ))
                .first(&mut self.connection)
                .expect("load credit request")
        }

        fn balance(&mut self) -> BigDecimal {
            users::table
                .filter(users::id.eq(USER_ID))
                .select(users::credit_balance)
                .first(&mut self.connection)
                .expect("load user balance")
        }

        /// Makes every subsequent balance increase fail at the database.
        fn reject_balance_updates(&mut self) {
            diesel::sql_query(
                "ALTER TABLE users ADD CONSTRAINT reject_credit CHECK (credit_balance = 0)",
            )
            .execute(&mut self.connection)
            .expect("add constraint");
        }

        fn allow_balance_updates(&mut self) {
            diesel::sql_query("ALTER TABLE users DROP CONSTRAINT reject_credit")
                .execute(&mut self.connection)
                .expect("drop constraint");
        }
    }

    impl Drop for TestDatabase {
        fn drop(&mut self) {
            if let Ok(mut admin) = PgConnection::establish(&self.admin_url) {
                let drop_database = format!("DROP DATABASE {} WITH (FORCE)", self.name);
                if let Err(error) = diesel::sql_query(drop_database).execute(&mut admin) {
                    eprintln!("failed to drop {}: {error}", self.name);
                }
            }
        }
    }

    #[test]
    fn credit_deposit_marks_order_processed_and_increases_balance() {
        let mut db = TestDatabase::new();
        let order_id = db.seed_pending_order();

        db.credit(order_id).expect("deposit should be credited");

        assert_eq!(
            db.order_state(order_id),
            (Some(BigDecimal::from(1000)), "PROCESSED".to_string())
        );
        assert_eq!(db.balance(), BigDecimal::from(1000));
    }

    #[test]
    fn credit_deposit_rolls_back_order_when_balance_update_fails_and_can_be_retried() {
        let mut db = TestDatabase::new();
        let order_id = db.seed_pending_order();
        db.reject_balance_updates();

        assert!(db.credit(order_id).is_err(), "balance failure must surface");
        assert_eq!(db.order_state(order_id), (None, "PENDING".to_string()));
        assert_eq!(db.balance(), BigDecimal::from(0));

        db.allow_balance_updates();
        db.credit(order_id).expect("retry should succeed");

        assert_eq!(
            db.order_state(order_id),
            (Some(BigDecimal::from(1000)), "PROCESSED".to_string())
        );
        assert_eq!(db.balance(), BigDecimal::from(1000));
    }

    #[test]
    fn credit_deposit_does_not_credit_an_order_twice() {
        let mut db = TestDatabase::new();
        let order_id = db.seed_pending_order();
        db.credit(order_id).expect("first credit should succeed");

        assert!(db.credit(order_id).is_err(), "replay must be rejected");

        assert_eq!(db.balance(), BigDecimal::from(1000));
    }

    #[test]
    fn credit_deposit_rejects_unknown_order() {
        let mut db = TestDatabase::new();
        let order_id = db.seed_pending_order();

        assert!(db.credit(order_id + 1).is_err());

        assert_eq!(db.balance(), BigDecimal::from(0));
    }
}

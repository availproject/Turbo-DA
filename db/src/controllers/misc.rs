use crate::{
    models::{
        accounts::Account, customer_expenditure::CustomerExpenditureGetWithPayload,
        user_model::User,
    },
    schema::{
        accounts::dsl as accounts, customer_expenditures::dsl as customer_expenditures,
        users::dsl as users,
    },
};
use bigdecimal::BigDecimal;
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use uuid::Uuid;

use super::users::TxParams;

pub async fn validate_and_get_entries(
    connection: &mut AsyncPgConnection,
    account_id: &Uuid,
) -> Result<(i32, BigDecimal), String> {
    let query: Result<(i32, BigDecimal), diesel::result::Error> = accounts::accounts
        .inner_join(users::users)
        .filter(accounts::id.eq(account_id))
        .select((accounts::app_id, users::credit_balance))
        .first::<(i32, BigDecimal)>(connection)
        .await;

    match query {
        Ok(info) => Ok(info),
        Err(e) => Err(format!("Error retrieving user balance: {}", e)),
    }
}

pub async fn get_account_by_id(
    connection: &mut AsyncPgConnection,
    account_id: &Uuid,
) -> Result<(Account, User), String> {
    let account = accounts::accounts
        .inner_join(users::users)
        .filter(accounts::id.eq(account_id))
        .select((Account::as_select(), User::as_select()))
        .first::<(Account, User)>(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(account)
}

pub async fn update_credit_balance(
    connection: &mut AsyncPgConnection,
    account_id: &Uuid,
    tx_params: &TxParams,
) -> Result<(), String> {
    let (account, _) = get_account_by_id(connection, account_id).await?;

    let mut leftover_val = BigDecimal::from(0);
    let mut user_credit_balance_change = &leftover_val;
    let mut account_credit_balance_change = &tx_params.amount_data_billed;

    if tx_params.amount_data_billed > account.credit_balance {
        leftover_val = &account.credit_balance - &tx_params.amount_data_billed;
        user_credit_balance_change = &leftover_val;
        account_credit_balance_change = &account.credit_balance;
    }
    if account_credit_balance_change != &BigDecimal::from(0) {
        diesel::update(accounts::accounts.filter(accounts::id.eq(account_id)))
            .set((
                accounts::credit_balance
                    .eq(accounts::credit_balance - account_credit_balance_change),
                accounts::credit_used.eq(accounts::credit_used + &tx_params.amount_data_billed),
            ))
            .execute(connection)
            .await
            .map_err(|e| {
                format!(
                "Couldn't update account credit balance for account id {:?}, fee: {:?}. Error {:?}",
                    account_id, tx_params.fees, e
                )
            })?;
    }

    if user_credit_balance_change > &BigDecimal::from(0) {
        diesel::update(users::users.filter(users::id.eq(account.user_id)))
            .set((
                users::credit_balance.eq(users::credit_balance - &user_credit_balance_change),
                users::credit_used.eq(users::credit_used + &user_credit_balance_change),
            ))
            .execute(connection)
            .await
            .map_err(|e| {
                format!(
                    "Couldn't update user credit balance for account id {:?}, fee: {:?}. Error {:?}",
                    account_id, tx_params.fees, e
                )
            })?;
    }
    Ok(())
}

/// Retrieves unresolved transactions from the database that have not exceeded retry limit
///
/// # Arguments
/// * `connection` - Database connection handle
/// * `retry` - Maximum number of retry attempts allowed
///
/// # Returns
/// * `Ok(Vec<CustomerExpenditureGetWithPayload>)` - List of unresolved transactions
/// * `Err(String)` - Error message if database query fails
///
/// # Description
/// Queries the database for transactions that:
/// 1. Have an error or payload
/// 2. Have not exceeded the maximum retry count
/// 3. Are ordered by creation date descending
pub async fn get_unresolved_transactions(
    connection: &mut AsyncPgConnection,
    retry: i32,
) -> Result<Vec<(CustomerExpenditureGetWithPayload, Account, User)>, String> {
    customer_expenditures::customer_expenditures
        .inner_join(accounts::accounts)
        .inner_join(users::users)
        .filter(customer_expenditures::error.is_not_null())
        .or_filter(customer_expenditures::payload.is_not_null().and(
            customer_expenditures::created_at.lt(diesel::dsl::sql::<diesel::sql_types::Timestamp>(
                "NOW() - INTERVAL '15 minutes'",
            )),
        ))
        .filter(customer_expenditures::retry_count.lt(retry))
        .order(customer_expenditures::created_at.desc())
        .select((
            CustomerExpenditureGetWithPayload::as_select(),
            Account::as_select(),
            User::as_select(),
        ))
        .load::<(CustomerExpenditureGetWithPayload, Account, User)>(connection)
        .await
        .map_err(|e| e.to_string())
}

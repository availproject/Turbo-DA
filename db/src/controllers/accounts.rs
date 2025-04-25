use crate::{
    models::accounts::{Account, AccountCreate},
    schema::accounts::dsl::*,
};
use bigdecimal::BigDecimal;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::SelectableHelper;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::{error, info};
use uuid::Uuid;

use super::users::{allocate_global_credit_balance, get_user};

pub async fn create_account(
    connection: &mut AsyncPgConnection,
    account: AccountCreate,
) -> Result<(), String> {
    diesel::insert_into(accounts)
        .values(account)
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_account_by_user_id(
    connection: &mut AsyncPgConnection,
    user_identifier: &String,
) -> Result<Account, String> {
    let account = accounts
        .filter(user_id.eq(user_identifier))
        .select(Account::as_select())
        .first::<Account>(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(account)
}

pub async fn delete_account_by_user_id(
    connection: &mut AsyncPgConnection,
    user_identifier: String,
) -> Result<(), String> {
    let account = get_account_by_user_id(connection, &user_identifier).await?;
    // check if there are allocated credits to this account. If so unlock on the main account.
    if account.credit_used > BigDecimal::from(0) {
        allocate_global_credit_balance(connection, &account.user_id, &account.credit_used).await?;
    }
    diesel::delete(accounts.filter(user_id.eq(user_identifier)))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Allocates or deallocates credits to a user's account
///
/// # Arguments
/// * `connection` - Database connection handle
/// * `user_id` - User ID to update
/// * `amount` - Amount to allocate (positive) or deallocate (negative)
///
/// # Returns
/// * `Ok(())` - If the allocation was successful
/// * `Err(String)` - Error message if the database operation fails
///
/// # Description
/// Updates the allocated_credit_balance field for a user ( not individual account), which tracks credits
/// that have been reserved for specific purposes. This function can both increase
/// (positive amount) or decrease (negative amount) the allocated balance.
pub async fn allocate_credit_balance(
    connection: &mut AsyncPgConnection,
    account_id: &Uuid,
    user: &String,
    amount: &BigDecimal,
) -> Result<(), String> {
    if amount < &BigDecimal::from(0) {
        return Err("Cannot allocate negative credits".to_string());
    }
    let user_obj = get_user(connection, user).await?;
    if amount > &BigDecimal::from(0)
        && user_obj.credit_balance - user_obj.allocated_credit_balance > *amount
    {
        return Err("Insufficient balance".to_string());
    }

    diesel::update(accounts.filter(id.eq(account_id)).filter(user_id.eq(user)))
        .set((credit_balance.eq(credit_balance + amount)))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

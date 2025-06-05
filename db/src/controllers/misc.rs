use crate::{
    models::{
        apps::Apps, customer_expenditure::CustomerExpenditureGetWithPayload,
        indexer::IndexerBlockNumbers, user_model::User,
    },
    schema::{
        apps::dsl as apps, customer_expenditures::dsl as customer_expenditures,
        indexer_block_numbers::dsl as indexer_block_numbers, users::dsl as users,
    },
};
use bigdecimal::BigDecimal;
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use uuid::Uuid;

use super::{
    apps::get_app_by_id,
    users::{get_user, TxParams},
};

pub async fn validate_and_get_entries(
    connection: &mut AsyncPgConnection,
    account_id: &Uuid,
) -> Result<(i32, BigDecimal), String> {
    let query: Result<(i32, BigDecimal), diesel::result::Error> = apps::apps
        .inner_join(users::users)
        .filter(apps::id.eq(account_id))
        .select((apps::app_id, users::credit_balance))
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
) -> Result<(Apps, User), String> {
    let account = apps::apps
        .inner_join(users::users)
        .filter(apps::id.eq(account_id))
        .select((Apps::as_select(), User::as_select()))
        .first::<(Apps, User)>(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(account)
}

pub async fn update_credit_balance(
    connection: &mut AsyncPgConnection,
    app: &Apps,
    tx_params: &TxParams,
    billed_from_credit: &BigDecimal,
    billed_from_fallback: &BigDecimal,
) -> Result<(), String> {
    diesel::update(apps::apps.filter(apps::id.eq(&app.id)))
        .set((
            apps::credit_balance.eq(apps::credit_balance - &billed_from_credit),
            apps::credit_used.eq(apps::credit_used + &billed_from_credit),
            apps::fallback_credit_used.eq(apps::fallback_credit_used + &billed_from_fallback),
        ))
        .execute(connection)
        .await
        .map_err(|e| {
            format!(
                "Couldn't update app credit balance for app id {:?}, fee: {:?}. Error {:?}",
                app.id, tx_params.fees, e
            )
        })?;

    if billed_from_fallback > &BigDecimal::from(0) {
        diesel::update(users::users.filter(users::id.eq(&app.user_id)))
            .set((
                users::credit_balance.eq(users::credit_balance - &billed_from_fallback),
                users::credit_used.eq(users::credit_used + &billed_from_fallback),
            ))
            .execute(connection)
            .await
            .map_err(|e| {
                format!(
                    "Couldn't update user credit balance for app id {:?}, fee: {:?}. Error {:?}",
                    app.id, tx_params.fees, e
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
    limit: i64,
) -> Result<Vec<(CustomerExpenditureGetWithPayload, Apps, User)>, String> {
    customer_expenditures::customer_expenditures
        .inner_join(apps::apps)
        .inner_join(users::users)
        .filter(customer_expenditures::error.is_not_null())
        .or_filter(customer_expenditures::payload.is_not_null().and(
            customer_expenditures::created_at.lt(diesel::dsl::sql::<diesel::sql_types::Timestamp>(
                "NOW() - INTERVAL '15 minutes'",
            )),
        ))
        .filter(customer_expenditures::retry_count.lt(retry))
        .order(customer_expenditures::created_at.desc())
        .limit(limit)
        .select((
            CustomerExpenditureGetWithPayload::as_select(),
            Apps::as_select(),
            User::as_select(),
        ))
        .load::<(CustomerExpenditureGetWithPayload, Apps, User)>(connection)
        .await
        .map_err(|e| e.to_string())
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
    if amount > &BigDecimal::from(0) && user_obj.credit_balance < *amount {
        return Err("Insufficient balance".to_string());
    }

    diesel::update(
        apps::apps
            .filter(apps::id.eq(account_id))
            .filter(apps::user_id.eq(user)),
    )
    .set((apps::credit_balance.eq(apps::credit_balance + amount),))
    .execute(connection)
    .await
    .map_err(|e| e.to_string())?;

    diesel::update(users::users.filter(users::id.eq(user)))
        .set((
            users::allocated_credit_balance.eq(users::allocated_credit_balance + amount),
            users::credit_balance.eq(users::credit_balance - amount),
        ))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn reclaim_credits(
    connection: &mut AsyncPgConnection,
    account_id: &Uuid,
    user: &String,
    amount: &BigDecimal,
) -> Result<(), String> {
    if amount < &BigDecimal::from(0) {
        return Err("Cannot reclaim negative credits".to_string());
    }

    let app_obj = get_app_by_id(connection, user, account_id).await?;
    if app_obj.credit_balance < *amount {
        return Err("Insufficient balance".to_string());
    }

    diesel::update(
        apps::apps
            .filter(apps::id.eq(account_id))
            .filter(apps::user_id.eq(user)),
    )
    .set(apps::credit_balance.eq(apps::credit_balance - amount))
    .execute(connection)
    .await
    .map_err(|e| e.to_string())?;

    diesel::update(users::users.filter(users::id.eq(user)))
        .set((
            users::allocated_credit_balance.eq(users::allocated_credit_balance - amount),
            users::credit_balance.eq(users::credit_balance + amount),
        ))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn indexer_status(
    connection: &mut AsyncPgConnection,
) -> Result<Vec<IndexerBlockNumbers>, String> {
    indexer_block_numbers::indexer_block_numbers
        .select(IndexerBlockNumbers::as_select())
        .load(connection)
        .await
        .map_err(|e| e.to_string())
}

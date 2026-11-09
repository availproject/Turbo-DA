use super::{
    apps::get_app_by_id,
    users::{get_user, TxParams},
};
use crate::{
    controllers::customer_expenditure::update_customer_expenditure,
    models::{
        apps::Apps, customer_expenditure::CustomerExpenditureGetWithPayload,
        indexer::IndexerBlockNumbers, user_model::User,
    },
    schema::{
        apps::dsl as apps, customer_expenditures::dsl as customer_expenditures,
        indexer_block_numbers::dsl as indexer_block_numbers, users::dsl as users,
    },
};
use avail_utils::submit_data::TransactionInfo;
use bigdecimal::BigDecimal;
use diesel::{prelude::*, result::Error};
use diesel_async::{AsyncConnection, AsyncPgConnection, RunQueryDsl};
use enigma::types::EncryptResponse;
use uuid::Uuid;

pub async fn validate_and_get_entries(
    connection: &mut AsyncPgConnection,
    account_id: &Uuid,
) -> Result<(i32, BigDecimal, BigDecimal), String> {
    let query: Result<(i32, BigDecimal, BigDecimal), diesel::result::Error> = apps::apps
        .inner_join(users::users)
        .filter(apps::id.eq(account_id))
        .select((apps::app_id, apps::credit_balance, users::credit_balance))
        .first::<(i32, BigDecimal, BigDecimal)>(connection)
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
        .filter(apps::barred.eq(false))
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
    ensure_no_submission_in_progress(connection, user).await?;
    let user_obj = get_user(connection, user).await?;
    if amount > &BigDecimal::from(0) && user_obj.credit_balance < *amount {
        return Err("Insufficient balance".to_string());
    }

    connection
        .transaction(async |conn| {
            // Update apps before users, as every credit move does, so concurrent moves can't deadlock.
            let updated = diesel::update(
                apps::apps
                    .filter(apps::id.eq(account_id))
                    .filter(apps::user_id.eq(user)),
            )
            .set((apps::credit_balance.eq(apps::credit_balance + amount),))
            .execute(&mut *conn)
            .await?;
            if updated != 1 {
                return Err(Error::NotFound);
            }

            // The balance condition, not the earlier read, is what stops concurrent overdrafts.
            let updated = diesel::update(
                users::users
                    .filter(users::id.eq(user))
                    .filter(users::credit_balance.ge(amount)),
            )
            .set((
                users::allocated_credit_balance.eq(users::allocated_credit_balance + amount),
                users::credit_balance.eq(users::credit_balance - amount),
            ))
            .execute(conn)
            .await?;
            if updated != 1 {
                return Err(Error::RollbackTransaction);
            }

            Ok::<(), Error>(())
        })
        .await
        .map_err(credit_move_error)
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
    ensure_no_submission_in_progress(connection, user).await?;

    let app_obj = get_app_by_id(connection, user, account_id).await?;
    if app_obj.credit_balance < *amount {
        return Err("Insufficient balance".to_string());
    }

    connection
        .transaction(async |conn| {
            // The balance condition, not the earlier read, is what stops concurrent overdrafts.
            let updated = diesel::update(
                apps::apps
                    .filter(apps::id.eq(account_id))
                    .filter(apps::user_id.eq(user))
                    .filter(apps::credit_balance.ge(amount)),
            )
            .set(apps::credit_balance.eq(apps::credit_balance - amount))
            .execute(&mut *conn)
            .await?;
            if updated != 1 {
                return Err(Error::RollbackTransaction);
            }

            diesel::update(users::users.filter(users::id.eq(user)))
                .set((
                    users::allocated_credit_balance.eq(users::allocated_credit_balance - amount),
                    users::credit_balance.eq(users::credit_balance + amount),
                ))
                .execute(conn)
                .await?;

            Ok::<(), Error>(())
        })
        .await
        .map_err(credit_move_error)
}

/// Credits are deducted only after data lands on Avail, so moving them while a submission is
/// posting would get that submission for free. The time limit stops a stuck row locking a user out.
pub(crate) async fn ensure_no_submission_in_progress(
    connection: &mut AsyncPgConnection,
    user: &str,
) -> Result<(), String> {
    let in_progress = diesel::select(diesel::dsl::exists(
        customer_expenditures::customer_expenditures
            .filter(customer_expenditures::user_id.eq(user))
            .filter(customer_expenditures::tx_hash.is_null())
            .filter(customer_expenditures::error.is_null())
            .filter(customer_expenditures::created_at.gt(
                diesel::dsl::sql::<diesel::sql_types::Timestamp>("NOW() - INTERVAL '15 minutes'"),
            )),
    ))
    .get_result::<bool>(connection)
    .await
    .map_err(|e| e.to_string())?;

    if in_progress {
        return Err("Cannot move credits while a submission is in progress".to_string());
    }
    Ok(())
}

/// A rollback here always means the balance condition matched no row.
fn credit_move_error(error: Error) -> String {
    match error {
        Error::RollbackTransaction => "Insufficient balance".to_string(),
        error => error.to_string(),
    }
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

pub async fn update_database_on_submission(
    submission_id: Uuid,
    connection: &mut AsyncPgConnection,
    result: TransactionInfo,
    account: &Apps,
    tx_params: TxParams,
    encrypted_data: Option<EncryptResponse>,
) -> Result<(), String> {
    let fees_as_bigdecimal = BigDecimal::from(&tx_params.fees);
    let (billed_from_credit, billed_from_fallback) = match account.credit_selection {
        Some(0) => (tx_params.amount_data_billed.clone(), BigDecimal::from(0)),
        Some(1) => (BigDecimal::from(0), tx_params.amount_data_billed.clone()),
        Some(2) => {
            if account.credit_balance >= BigDecimal::from(0) {
                if tx_params.amount_data_billed > account.credit_balance {
                    (
                        account.credit_balance.clone(),
                        &tx_params.amount_data_billed - &account.credit_balance,
                    )
                } else {
                    (tx_params.amount_data_billed.clone(), BigDecimal::from(0))
                }
            } else {
                (BigDecimal::from(0), tx_params.amount_data_billed.clone())
            }
        }
        _ => (BigDecimal::from(0), tx_params.amount_data_billed.clone()),
    };

    // Convert BigDecimal values to u64 and create wallet store
    let fallback_u64 = billed_from_fallback
        .round(0)
        .to_string()
        .parse::<i128>()
        .unwrap_or(0);
    let credit_u64 = billed_from_credit
        .round(0)
        .to_string()
        .parse::<i128>()
        .unwrap_or(0);

    let mut wallet_store = vec![0u8; 32];
    wallet_store[0..16].copy_from_slice(&fallback_u64.to_be_bytes());
    wallet_store[16..32].copy_from_slice(&credit_u64.to_be_bytes());

    update_customer_expenditure(
        result,
        encrypted_data,
        &fees_as_bigdecimal,
        &tx_params.amount_data_billed,
        &wallet_store,
        submission_id,
        connection,
    )
    .await?;
    update_credit_balance(
        connection,
        &account,
        &tx_params,
        &billed_from_credit,
        &billed_from_fallback,
    )
    .await?;

    Ok(())
}

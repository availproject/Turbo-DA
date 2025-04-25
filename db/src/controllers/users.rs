use crate::{
    models::user_model::{User, UserCreate},
    schema::users::dsl::*,
};
use bigdecimal::BigDecimal;
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::{error, info};

/// Parameters for transaction details
#[derive(Clone)]
pub struct TxParams {
    pub amount_data: String,
    pub amount_data_billed: BigDecimal,
    pub fees: u128,
}

pub async fn update_credit_balance(
    connection: &mut AsyncPgConnection,
    user_id: &String,
    tx_params: &TxParams,
) {
    let tx = diesel::update(users.find(&user_id))
        .set((
            credit_balance.eq(credit_balance - &tx_params.amount_data_billed),
            credit_used.eq(credit_used + &tx_params.amount_data_billed),
        ))
        .execute(connection)
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
                user_id, tx_params.fees, e
            );
        }
    }
}

/// Validates user existence and retrieves their app ID and credit balance
///
/// # Arguments
/// * `connection` - Database connection handle
/// * `user` - User ID to look up
///
/// # Returns
/// * `Ok((i32, BigDecimal))` - Tuple containing app_id and credit_balance if user exists
/// * `Err(String)` - Error message if user not found or database error occurs
///
/// # Description
/// Queries the database for a user record and returns their associated app ID
/// and current credit balance. Used for validating users and checking balances
/// before processing transactions.
pub async fn validate_and_get_entries(
    connection: &mut AsyncPgConnection,
    user: &String,
) -> Result<(i32, BigDecimal), String> {
    let query: Result<User, diesel::result::Error> = users
        .filter(id.eq(user))
        .select(User::as_select())
        .first::<User>(connection)
        .await;

    match query {
        Ok(info) => Ok((info.app_id, info.credit_balance)),
        Err(e) => Err(format!("Error retrieving user balance: {}", e)),
    }
}

pub async fn get_app_id(connection: &mut AsyncPgConnection, user: &String) -> Result<i32, String> {
    match users
        .filter(id.eq(user))
        .select(User::as_select())
        .first::<User>(connection)
        .await
    {
        Ok(user) => Ok(user.app_id),
        Err(_) => Err("DB Call Error".to_string()),
    }
}

pub async fn get_all_users(
    connection: &mut AsyncPgConnection,
    final_limit: i64,
) -> Result<Vec<User>, String> {
    let result = users
        .limit(final_limit)
        .select(User::as_select())
        .load(&mut *connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(result)
}

pub async fn register_new_user(
    connection: &mut AsyncPgConnection,
    user: UserCreate,
) -> Result<(), String> {
    diesel::insert_into(users)
        .values(user)
        .execute(&mut *connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn allocate_global_credit_balance(
    connection: &mut AsyncPgConnection,
    user: &String,
    amount: &BigDecimal,
) -> Result<(), String> {
    diesel::update(users.filter(id.eq(user)))
        .set((credit_balance.eq(credit_balance + amount)))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_user(connection: &mut AsyncPgConnection, user: &String) -> Result<User, String> {
    let query = users
        .filter(id.eq(user))
        .select(User::as_select())
        .first::<User>(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(query)
}

pub async fn user_exists(
    connection: &mut AsyncPgConnection,
    user_email: &str,
) -> Result<bool, String> {
    let query = diesel::select(diesel::dsl::exists(users.filter(id.eq(user_email))))
        .get_result(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(query)
}

pub async fn update_app_id(
    connection: &mut AsyncPgConnection,
    user_id: &String,
    new_app_id: i32,
) -> Result<(), String> {
    diesel::update(users.filter(id.eq(user_id)))
        .set(app_id.eq(new_app_id))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

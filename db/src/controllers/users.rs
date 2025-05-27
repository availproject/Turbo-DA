use crate::{
    models::user_model::{User, UserCreate},
    schema::users::dsl::*,
};
use bigdecimal::BigDecimal;
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};

/// Parameters for transaction details
#[derive(Clone)]
pub struct TxParams {
    pub amount_data: String,
    pub amount_data_billed: BigDecimal,
    pub fees: u128,
}

pub async fn get_all_users(
    connection: &mut AsyncPgConnection,
    user_id: &Option<String>,
    limit: &Option<i64>,
) -> Result<Vec<User>, String> {
    let mut query = users.select(User::as_select()).into_boxed();
    if let Some(user_id) = user_id {
        query = query.filter(id.eq(user_id));
    }
    if let Some(limit) = limit {
        query = query.limit(*limit);
    }
    let result = query
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
        .set(credit_balance.eq(credit_balance + amount))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_user(connection: &mut AsyncPgConnection, user: &String) -> Result<User, String> {
    let query = users
        .left_join(crate::schema::apps::dsl::apps)
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

pub async fn fund_user(
    connection: &mut AsyncPgConnection,
    user: &String,
    amount: &BigDecimal,
) -> Result<User, String> {
    let result = diesel::update(users.filter(id.eq(user)))
        .set(credit_balance.eq(credit_balance + amount))
        .returning(User::as_returning())
        .get_result(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(result)
}

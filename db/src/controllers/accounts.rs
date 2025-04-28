use crate::{
    models::accounts::{Account, AccountCreate},
    schema::{accounts::dsl::*, users},
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
    account: &AccountCreate,
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
    account_id: Uuid,
) -> Result<Account, String> {
    let account = accounts
        .filter(id.eq(account_id))
        .filter(user_id.eq(user_identifier))
        .select(Account::as_select())
        .first::<Account>(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(account)
}

pub async fn delete_account_by_id(
    connection: &mut AsyncPgConnection,
    user_identifier: String,
    account_id: Uuid,
) -> Result<(), String> {
    let account = get_account_by_user_id(connection, &user_identifier, account_id).await?;
    // check if there are allocated credits to this account. If so unlock on the main account.
    if account.credit_used > BigDecimal::from(0) {
        allocate_global_credit_balance(connection, &account.user_id, &account.credit_used).await?;
    }
    diesel::delete(
        accounts
            .filter(id.eq(account_id))
            .filter(user_id.eq(user_identifier)),
    )
    .execute(connection)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn update_app_id(
    connection: &mut AsyncPgConnection,
    account_id: &Uuid,
    user: &String,
    new_app_id: i32,
) -> Result<(), String> {
    diesel::update(accounts.filter(id.eq(account_id)).filter(user_id.eq(user)))
        .set(app_id.eq(new_app_id))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_app_id(
    connection: &mut AsyncPgConnection,
    account_id: &Uuid,
) -> Result<i32, String> {
    match accounts
        .filter(id.eq(account_id))
        .select(Account::as_select())
        .first::<Account>(connection)
        .await
    {
        Ok(account) => Ok(account.app_id),
        Err(_) => Err("DB Call Error".to_string()),
    }
}

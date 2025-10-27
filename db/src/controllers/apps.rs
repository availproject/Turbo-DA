use crate::{
    models::apps::{Apps, AppsCreate},
    schema::apps::dsl::*,
};
use bigdecimal::BigDecimal;
use diesel::{dsl, BoolExpressionMethods, ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use uuid::Uuid;

use super::users::allocate_global_credit_balance;

pub async fn create_account(
    connection: &mut AsyncPgConnection,
    account: &AppsCreate,
) -> Result<(), String> {
    diesel::insert_into(apps)
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
) -> Result<Apps, String> {
    let account = apps
        .filter(id.eq(account_id))
        .filter(user_id.eq(user_identifier))
        .select(Apps::as_select())
        .first::<Apps>(connection)
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
        apps.filter(id.eq(account_id))
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
    diesel::update(apps.filter(id.eq(account_id)).filter(user_id.eq(user)))
        .set(app_id.eq(new_app_id))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_app_id(connection: &mut AsyncPgConnection, app: &Uuid) -> Result<i32, String> {
    let account = apps
        .filter(id.eq(app))
        .select(Apps::as_select())
        .first::<Apps>(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(account.app_id)
}

pub async fn get_all_apps(
    connection: &mut AsyncPgConnection,
    user: &Option<String>,
    app: &Option<Uuid>,
) -> Result<Vec<Apps>, String> {
    let mut query = apps.select(Apps::as_select()).into_boxed();
    if let Some(app) = app {
        query = query.filter(id.eq(app));
    }
    if let Some(user) = user {
        query = query.filter(user_id.eq(user));
    }
    query
        .load::<Apps>(connection)
        .await
        .map_err(|e| e.to_string())
}

pub async fn get_apps(
    connection: &mut AsyncPgConnection,
    user: &String,
) -> Result<Vec<Apps>, String> {
    apps.filter(user_id.eq(user))
        .select(Apps::as_select())
        .load::<Apps>(connection)
        .await
        .map_err(|e| e.to_string())
}

pub async fn get_app_by_id(
    connection: &mut AsyncPgConnection,
    extracted_user_id: &String,
    id_query: &Uuid,
) -> Result<Apps, String> {
    apps.filter(id.eq(id_query))
        .filter(user_id.eq(extracted_user_id))
        .select(Apps::as_select())
        .first::<Apps>(connection)
        .await
        .map_err(|e| e.to_string())
}

pub async fn update_app_account(
    connection: &mut AsyncPgConnection,
    payload: &Apps,
) -> Result<(), String> {
    diesel::update(apps.filter(id.eq(payload.id)))
        .set((
            app_name.eq(&payload.app_name),
            app_description.eq(&payload.app_description),
            app_logo.eq(&payload.app_logo),
            credit_selection.eq(&payload.credit_selection),
        ))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn toggle_encryption(
    connection: &mut AsyncPgConnection,
    user: &String,
    app: &Uuid,
) -> Result<(), String> {
    diesel::update(apps.filter(id.eq(app)).filter(user_id.eq(user)))
        .set(encryption.eq(dsl::not(encryption)))
        .execute(connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

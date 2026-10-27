use crate::{
    models::apps::{Apps, AppsCreate},
    schema::{apps::dsl::*, users::dsl as users},
};
use bigdecimal::BigDecimal;
use diesel::{dsl, ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::{AsyncConnection, AsyncPgConnection, RunQueryDsl};
use uuid::Uuid;

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
    connection
        .transaction(async |conn| {
            // Lock the row so a concurrent submission can't spend credits between read and delete.
            let account = apps
                .filter(id.eq(account_id))
                .filter(user_id.eq(&user_identifier))
                .select(Apps::as_select())
                .for_update()
                .first::<Apps>(&mut *conn)
                .await?;
            // Return the unspent allocation to the main account. `credit_used` has already been
            // paid out on Avail and must not be refunded.
            if account.credit_balance > BigDecimal::from(0) {
                diesel::update(users::users.filter(users::id.eq(&account.user_id)))
                    .set((
                        users::credit_balance.eq(users::credit_balance + &account.credit_balance),
                        users::allocated_credit_balance
                            .eq(users::allocated_credit_balance - &account.credit_balance),
                    ))
                    .execute(&mut *conn)
                    .await?;
            }
            diesel::delete(apps.filter(id.eq(account_id)))
                .execute(conn)
                .await?;
            Ok::<(), diesel::result::Error>(())
        })
        .await
        .map_err(|e| e.to_string())
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

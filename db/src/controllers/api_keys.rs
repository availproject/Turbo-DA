use crate::{
    models::api::{ApiKey, ApiKeyCreate, ApiKeyMeta},
    schema::api_keys::dsl::*,
};

use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::SelectableHelper;
use diesel_async::{AsyncPgConnection, RunQueryDsl};

use super::misc::get_account_by_id;

pub async fn create_api_key(
    connection: &mut AsyncPgConnection,
    key: &ApiKeyCreate,
) -> Result<(), String> {
    let account = get_account_by_id(connection, &key.app_id).await?;
    if account.0.user_id != key.user_id {
        return Err("Account does not belong to user".to_string());
    }
    diesel::insert_into(api_keys)
        .values(key)
        .execute(&mut *connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_api_keys(
    connection: &mut AsyncPgConnection,
    user: &String,
) -> Result<Vec<ApiKey>, String> {
    let result = api_keys
        .filter(user_id.eq(user))
        .select(ApiKey::as_select())
        .load(&mut *connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(result)
}

pub async fn delete_api_key(
    connection: &mut AsyncPgConnection,
    user: &String,
    ident: &String,
) -> Result<Vec<ApiKey>, String> {
    let deleted_keys = diesel::delete(
        api_keys
            .filter(user_id.eq(user))
            .filter(identifier.eq(ident)),
    )
    .returning(ApiKey::as_select())
    .load(&mut *connection)
    .await
    .map_err(|e| e.to_string())?;

    Ok(deleted_keys)
}

/// Lists a user's API keys without ever loading the hashed key material.
pub async fn get_api_keys_meta(
    connection: &mut AsyncPgConnection,
    user: &String,
) -> Result<Vec<ApiKeyMeta>, diesel::result::Error> {
    api_keys
        .filter(user_id.eq(user))
        .order(created_at.desc())
        .select(ApiKeyMeta::as_select())
        .load(&mut *connection)
        .await
}

pub async fn update_api_key_label(
    connection: &mut AsyncPgConnection,
    user: &String,
    ident: &String,
    new_label: Option<String>,
) -> Result<usize, diesel::result::Error> {
    diesel::update(
        api_keys
            .filter(user_id.eq(user))
            .filter(identifier.eq(ident)),
    )
    .set(label.eq(new_label))
    .execute(&mut *connection)
    .await
}

/// Records that a key was just used to authenticate a submission.
pub async fn touch_last_used(
    connection: &mut AsyncPgConnection,
    key_hash: &String,
) -> Result<usize, diesel::result::Error> {
    diesel::update(api_keys.filter(api_key.eq(key_hash)))
        .set(last_used_at.eq(diesel::dsl::now))
        .execute(&mut *connection)
        .await
}

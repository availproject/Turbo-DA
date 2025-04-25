use crate::{
    models::api::{ApiKey, ApiKeyCreate},
    schema::api_keys::dsl::*,
};

use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::SelectableHelper;
use diesel_async::{AsyncPgConnection, RunQueryDsl};

pub async fn create_api_key(
    connection: &mut AsyncPgConnection,
    key: &ApiKeyCreate,
) -> Result<(), String> {
    diesel::insert_into(api_keys)
        .values(key)
        .execute(&mut *connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_api_key(
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

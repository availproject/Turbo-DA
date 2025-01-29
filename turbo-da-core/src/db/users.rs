use bigdecimal::BigDecimal;
use db::{models::user_model::User, schema::users::dsl::*};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};

pub async fn validate_and_get_entries(
    connection: &mut AsyncPgConnection,
    user: &String,
) -> Result<(i32, BigDecimal), String> {
    let query: Result<(User), diesel::result::Error> = users
        .filter(db::schema::users::id.eq(user))
        .select(User::as_select())
        .first::<User>(connection)
        .await;

    match query {
        Ok(info) => Ok((info.app_id, info.credit_balance)),
        Err(e) => Err(format!("Error retrieving user balance: {}", e)),
    }
}

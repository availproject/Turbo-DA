use db::{models::user_model::User, schema::users::dsl::*};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
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

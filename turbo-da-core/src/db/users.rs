use bigdecimal::BigDecimal;
use db::{models::user_model::User, schema::users::dsl::*};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};

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
        .filter(db::schema::users::id.eq(user))
        .select(User::as_select())
        .first::<User>(connection)
        .await;

    match query {
        Ok(info) => Ok((info.app_id, info.credit_balance)),
        Err(e) => Err(format!("Error retrieving user balance: {}", e)),
    }
}

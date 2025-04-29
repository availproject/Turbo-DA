use crate::{models::credit_requests::CreditRequestInfo, schema::credit_requests::dsl::*};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};

pub async fn get_fund_status(
    user: String,
    connection: &mut AsyncPgConnection,
) -> Result<Vec<CreditRequestInfo>, String> {
    credit_requests
        .filter(user_id.eq(user))
        .select(CreditRequestInfo::as_select())
        .load(&mut *connection)
        .await
        .map_err(|e| format!("Error loading fund status: {}", e))
}

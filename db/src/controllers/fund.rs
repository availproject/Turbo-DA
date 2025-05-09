use crate::{
    models::credit_requests::{CreditRequestInfo, CreditRequestsGet},
    schema::credit_requests::dsl::*,
};
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

pub async fn create_credit_request(
    user: String,
    chain: i32,
    connection: &mut AsyncPgConnection,
) -> Result<CreditRequestsGet, String> {
    let res = diesel::insert_into(credit_requests)
        .values((
            user_id.eq(user),
            chain_id.eq(chain),
            request_status.eq("PENDING"),
            request_type.eq("DEPOSIT"),
        ))
        .returning(CreditRequestsGet::as_returning())
        .get_result::<CreditRequestsGet>(connection)
        .await
        .map_err(|e| format!("Error creating credit request: {}", e))?;
    Ok(res)
}

pub async fn get_fund_list(
    user: String,
    connection: &mut AsyncPgConnection,
) -> Result<Vec<CreditRequestInfo>, String> {
    credit_requests
        .filter(user_id.eq(user))
        .select(CreditRequestInfo::as_select())
        .load(&mut *connection)
        .await
        .map_err(|e| format!("Error loading fund list: {}", e))
}

use crate::{
    models::credit_requests::{CreditRequestInfo, CreditRequestsGet},
    schema::credit_requests::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use uuid::Uuid;

pub async fn get_fund_status(
    user: String,
    fund_id: i32,
    connection: &mut AsyncPgConnection,
) -> Result<Vec<CreditRequestInfo>, String> {
    credit_requests
        .filter(id.eq(fund_id))
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

pub async fn update_inclusion_details(
    user: String,
    order_id: i32,
    tx: String,
    connection: &mut AsyncPgConnection,
) -> Result<CreditRequestsGet, String> {
    let res = diesel::update(
        credit_requests
            .filter(id.eq(order_id))
            .filter(user_id.eq(user)),
    )
    .set((tx_hash.eq(tx), request_status.eq("INCLUDED")))
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

/// Paginated variant of [`get_fund_list`], newest request first.
pub async fn get_fund_list_paged(
    connection: &mut AsyncPgConnection,
    user: &String,
    limit: i64,
    offset: i64,
) -> Result<Vec<CreditRequestInfo>, diesel::result::Error> {
    credit_requests
        .filter(user_id.eq(user))
        .order(created_at.desc())
        .limit(limit)
        .offset(offset)
        .select(CreditRequestInfo::as_select())
        .load(&mut *connection)
        .await
}

pub async fn count_fund_list(
    connection: &mut AsyncPgConnection,
    user: &String,
) -> Result<i64, diesel::result::Error> {
    credit_requests
        .filter(user_id.eq(user))
        .count()
        .get_result::<i64>(&mut *connection)
        .await
}

pub async fn get_all_fund_requests(
    user: &Option<String>,
    app: &Option<Uuid>,
    connection: &mut AsyncPgConnection,
) -> Result<Vec<CreditRequestInfo>, String> {
    let mut query = credit_requests
        .select(CreditRequestInfo::as_select())
        .into_boxed();
    if let Some(user) = user {
        query = query.filter(user_id.eq(user));
    }
    if let Some(app) = app {
        query = query.filter(app_id.eq(app));
    }
    query
        .select(CreditRequestInfo::as_select())
        .load(&mut *connection)
        .await
        .map_err(|e| format!("Error loading fund list: {}", e))
}

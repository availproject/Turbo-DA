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

/// Stores the client-reported transaction hash on an order that has not been credited yet.
///
/// A credited order holds the hash verified by the indexer, so it is returned unchanged.
pub async fn update_inclusion_details(
    user: String,
    order_id: i32,
    tx: String,
    connection: &mut AsyncPgConnection,
) -> Result<CreditRequestsGet, String> {
    let updated = diesel::update(
        credit_requests
            .filter(id.eq(order_id))
            .filter(user_id.eq(&user))
            .filter(amount_credit.is_null()),
    )
    .set((tx_hash.eq(tx), request_status.eq("INCLUDED")))
    .returning(CreditRequestsGet::as_returning())
    .get_result::<CreditRequestsGet>(connection)
    .await
    .optional()
    .map_err(|e| format!("Error updating credit request: {}", e))?;

    if let Some(row) = updated {
        return Ok(row);
    }

    credit_requests
        .filter(id.eq(order_id))
        .filter(user_id.eq(user))
        .select(CreditRequestsGet::as_select())
        .first::<CreditRequestsGet>(connection)
        .await
        .map_err(|e| format!("Error loading credit request: {}", e))
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

use bigdecimal::BigDecimal;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::fund_requests)]
pub struct FundRequests {
    pub user_id: String,
    pub token_address: String,
    pub amount_token: BigDecimal,
    pub chain_id: i32,
    pub request_status: String,
    pub request_type: String,
    pub tx_hash: String,
}

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::fund_requests)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct FundRequestsGet {
    pub id: i32,
    pub user_id: String,
    pub token_address: String,
    pub chain_id: i32,
    pub amount_token: BigDecimal,
    pub request_status: String,
    pub created_at: chrono::NaiveDateTime,
    pub request_type: String,
    pub tx_hash: String,
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::fund_requests)]
pub struct FundRequestInfo {
    pub token_address: String,
    pub amount_token: BigDecimal,
    pub chain_id: i32,
    pub request_status: String,
    pub request_type: String,
    pub tx_hash: String,
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::fund_requests)]
pub struct ChainIdInfo {
    pub chain_id: i32,
}

use bigdecimal::BigDecimal;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::credit_requests)]
pub struct CreditRequests {
    pub amount_credit: Option<BigDecimal>,
    pub chain_id: Option<i32>,
    pub request_status: String,
    pub request_type: String,
    pub tx_hash: Option<String>,
}

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug, Insertable)]
#[diesel(table_name = crate::schema::credit_requests)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct CreditRequestsGet {
    pub id: i32,
    pub user_id: String,
    pub chain_id: Option<i32>,
    pub amount_credit: Option<BigDecimal>,
    pub request_status: String,
    pub created_at: chrono::NaiveDateTime,
    pub request_type: String,
    pub tx_hash: Option<String>,
}

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::credit_requests)]
pub struct CreditRequestInfo {
    pub amount_credit: Option<BigDecimal>,
    pub chain_id: Option<i32>,
    pub request_status: String,
    pub request_type: String,
    pub tx_hash: Option<String>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::credit_requests)]
pub struct ChainIdInfo {
    pub chain_id: Option<i32>,
}

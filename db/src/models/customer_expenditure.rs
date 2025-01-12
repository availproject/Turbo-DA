use bigdecimal::BigDecimal;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::customer_expenditures)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct CustomerExpenditureGet {
    pub id: Uuid,
    pub user_id: String,
    pub token_details_id: i32,
    pub extrinsic_index: Option<i32>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub amount_data: String,
    #[diesel(sql_type = diesel::sql_types::Numeric)]
    pub fees: Option<BigDecimal>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub to_address: Option<String>,
    pub block_number: Option<i32>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub block_hash: Option<String>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub data_hash: Option<String>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub tx_hash: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub error: Option<String>,
    #[diesel(sql_type = diesel::sql_types::Numeric)]
    pub converted_fees: Option<BigDecimal>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub payment_token: String,
}

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::customer_expenditures)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct CustomerExpenditureGetWithPayload {
    pub id: Uuid,
    pub user_id: String,
    pub token_details_id: i32,
    pub extrinsic_index: Option<i32>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub amount_data: String,
    #[diesel(sql_type = diesel::sql_types::Numeric)]
    pub fees: Option<BigDecimal>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub to_address: Option<String>,
    pub block_number: Option<i32>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub block_hash: Option<String>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub data_hash: Option<String>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub tx_hash: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub error: Option<String>,
    #[diesel(sql_type = diesel::sql_types::Numeric)]
    pub converted_fees: Option<BigDecimal>,
    pub payload: Option<Vec<u8>>,
    #[diesel(sql_type = diesel::sql_types::VarChar)]
    pub payment_token: String,
}

#[derive(Insertable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::customer_expenditures)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct CreateCustomerExpenditure {
    pub id: Uuid,
    pub user_id: String,
    pub token_details_id: i32,
    pub amount_data: String,
    pub error: Option<String>,
    pub payload: Option<Vec<u8>>,
    pub payment_token: String,
}

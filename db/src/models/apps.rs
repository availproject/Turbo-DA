use bigdecimal::BigDecimal;
use diesel::prelude::*;

use serde::{Deserialize, Serialize};
#[derive(Queryable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::apps)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Apps {
    pub id: uuid::Uuid,
    pub created_at: chrono::NaiveDateTime,
    pub user_id: String,
    pub app_id: i32,
    pub credit_balance: BigDecimal,
    pub credit_used: BigDecimal,
    pub app_name: Option<String>,
    pub app_description: Option<String>,
    pub app_logo: Option<String>,
    pub credit_selection: Option<i16>,
    pub fallback_credit_used: BigDecimal,
    pub encrypted_data: bool,
}

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::apps)]
pub struct AppsCreate {
    pub id: uuid::Uuid,
    pub user_id: String,
    pub app_id: i32,
    pub credit_balance: BigDecimal,
    pub credit_used: BigDecimal,
    pub credit_selection: Option<i16>,
    pub app_name: Option<String>,
    pub app_description: Option<String>,
    pub app_logo: Option<String>,
    pub encrypted_data: bool,
}

use bigdecimal::BigDecimal;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct User {
    pub id: String,
    pub name: String,
    pub credit_balance: BigDecimal,
    pub credit_used: BigDecimal,
    pub allocated_credit_balance: BigDecimal,
    pub sumsub_timestamp: Option<chrono::NaiveDateTime>,
}

#[derive(Insertable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = crate::schema::users)]
pub struct UserCreate {
    pub id: String,
    pub name: String,
    pub sumsub_timestamp: Option<chrono::NaiveDateTime>,
}

#[derive(Queryable, Selectable, Identifiable, Serialize, Deserialize)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct UserLogin {
    pub id: String,
    pub name: String,
    pub credit_balance: BigDecimal,
    pub credit_used: BigDecimal,
    pub allocated_credit_balance: BigDecimal,
    pub sumsub_timestamp: Option<chrono::NaiveDateTime>,
}

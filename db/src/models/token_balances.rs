use bigdecimal::BigDecimal;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = crate::schema::token_balances)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct TokenBalances {
    pub token_details_id: i32,
    pub user_id: String,
    pub token_address: String,
    pub token_balance: BigDecimal,
    pub token_used: BigDecimal,
    pub token_amount_locked: BigDecimal,
}

#[derive(Insertable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = crate::schema::token_balances)]
pub struct TokenBalancesCreate {
    pub user_id: String,
    pub token_address: String,
    pub token_balance: BigDecimal,
    pub token_used: Option<BigDecimal>,
}

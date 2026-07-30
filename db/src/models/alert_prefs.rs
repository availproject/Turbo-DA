use crate::schema::user_alert_prefs;
use bigdecimal::BigDecimal;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Queryable, Selectable, Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = user_alert_prefs)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct UserAlertPrefs {
    pub user_id: String,
    pub low_balance_enabled: bool,
    pub low_balance_credits: Option<BigDecimal>,
    pub runway_enabled: bool,
    pub runway_days: Option<i32>,
    pub failed_post_enabled: bool,
    pub low_balance_alerted_at: Option<NaiveDateTime>,
    pub runway_alerted_at: Option<NaiveDateTime>,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = user_alert_prefs)]
pub struct UserAlertPrefsUpsert {
    pub user_id: String,
    pub low_balance_enabled: bool,
    pub low_balance_credits: Option<BigDecimal>,
    pub runway_enabled: bool,
    pub runway_days: Option<i32>,
    pub failed_post_enabled: bool,
}

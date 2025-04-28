use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::api_keys)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct ApiKey {
    pub api_key: String,
    pub created_at: chrono::NaiveDateTime,
    pub user_id: String,
    pub identifier: String,
    pub account_id: Uuid,
}

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::api_keys)]
pub struct ApiKeyCreate {
    pub user_id: String,
    pub api_key: String,
    pub account_id: Uuid,
    pub identifier: String,
}

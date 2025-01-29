use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::api_keys)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct ApiKey {
    pub api_key: String,
    pub created_at: chrono::NaiveDateTime,
    pub user_id: String,
}

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::api_keys)]
pub struct ApiKeyCreate {
    pub api_key: String,
    pub user_id: String,
}

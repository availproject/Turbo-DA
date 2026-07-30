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
    pub app_id: Uuid,
    pub label: Option<String>,
    pub last_used_at: Option<chrono::NaiveDateTime>,
}

/// Everything about an API key that is safe to hand back to the dashboard.
/// Deliberately excludes the hashed `api_key` column.
#[derive(Queryable, Selectable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = crate::schema::api_keys)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct ApiKeyMeta {
    pub app_id: Uuid,
    pub identifier: String,
    pub label: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub last_used_at: Option<chrono::NaiveDateTime>,
}

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::api_keys)]
pub struct ApiKeyCreate {
    pub user_id: String,
    pub api_key: String,
    pub app_id: Uuid,
    pub identifier: String,
    pub label: Option<String>,
}

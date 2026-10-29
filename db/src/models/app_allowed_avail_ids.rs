use crate::schema::app_allowed_avail_ids;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = app_allowed_avail_ids)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct AppAllowedAvailId {
    pub app_id: Uuid,
    pub avail_app_id: i32,
}

#[derive(Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = app_allowed_avail_ids)]
pub struct AppAllowedAvailIdCreate {
    pub app_id: Uuid,
    pub avail_app_id: i32,
}

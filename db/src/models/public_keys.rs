use crate::schema::public_keys;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = public_keys)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct PublicKey {
    pub id: Uuid,
    pub user_id: String,
    pub public_address: String,
    pub created_at: NaiveDateTime,
}

#[derive(Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = public_keys)]
pub struct PublicKeyCreate {
    pub id: Uuid,
    pub user_id: String,
    pub public_address: String,
}

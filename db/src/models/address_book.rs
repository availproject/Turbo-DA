use crate::schema::address_book;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = address_book)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct AddressBookEntry {
    pub id: Uuid,
    pub user_id: String,
    pub address: String,
    pub name: String,
    pub role: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = address_book)]
pub struct AddressBookCreate {
    pub id: Uuid,
    pub user_id: String,
    pub address: String,
    pub name: String,
    pub role: Option<String>,
}

use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
    pub app_id: i32,
    pub assigned_wallet: String,
}

#[derive(Insertable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = crate::schema::users)]
pub struct UserCreate {
    pub id: String,
    pub name: String,
    pub email: String,
    pub app_id: i32,
    pub assigned_wallet: String,
}

#[derive(Queryable, Selectable, Identifiable, Serialize, Deserialize)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct UserLogin {
    pub id: String,
    pub name: String,
    pub email: String,
    pub app_id: i32,
    pub assigned_wallet: String,
}

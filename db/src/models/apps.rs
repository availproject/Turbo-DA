use bigdecimal::BigDecimal;
use diesel::{
    deserialize::{self, FromSql, FromSqlRow},
    expression::AsExpression,
    pg::{Pg, PgValue},
    prelude::*,
    serialize::{self, Output, ToSql},
    sql_types::{Integer, Record, Text},
};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, FromSqlRow, AsExpression, PartialEq, Eq, Serialize, Deserialize)]
#[diesel(sql_type = crate::schema::sql_types::FallbackStatus)]
pub struct Status {
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub value: bool,
}

impl Status {
    pub fn new(updated_at: chrono::DateTime<chrono::Utc>, value: bool) -> Self {
        Self { updated_at, value }
    }
}

impl ToSql<crate::schema::sql_types::FallbackStatus, Pg> for Status {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        serialize::WriteTuple::<(diesel::sql_types::Timestamptz, diesel::sql_types::Bool)>::write_tuple(
            &(&self.updated_at.naive_utc(), &self.value),
            &mut out.reborrow(),
        )
    }
}
impl FromSql<crate::schema::sql_types::FallbackStatus, Pg> for Status {
    fn from_sql(bytes: PgValue<'_>) -> deserialize::Result<Self> {
        let (updated_at, value) = FromSql::<
            Record<(diesel::sql_types::Timestamptz, diesel::sql_types::Bool)>,
            Pg,
        >::from_sql(bytes)?;

        Ok(Status { updated_at, value })
    }
}

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::apps)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Apps {
    pub id: uuid::Uuid,
    pub created_at: chrono::NaiveDateTime,
    pub user_id: String,
    pub app_id: i32,
    pub credit_balance: BigDecimal,
    pub credit_used: BigDecimal,
    pub app_name: Option<String>,
    pub app_description: Option<String>,
    pub app_logo: Option<String>,
    pub fallback_enabled: bool,
    pub fallback_updated_at: Vec<Option<Status>>,
}

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::apps)]
pub struct AppsCreate {
    pub id: uuid::Uuid,
    pub user_id: String,
    pub app_id: i32,
    pub credit_balance: BigDecimal,
    pub credit_used: BigDecimal,
    pub fallback_enabled: bool,
    pub app_name: Option<String>,
    pub app_description: Option<String>,
    pub app_logo: Option<String>,
}

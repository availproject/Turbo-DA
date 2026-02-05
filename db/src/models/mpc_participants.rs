use crate::schema::mpc_participants;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = mpc_participants)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct MpcParticipant {
    pub id: Uuid,
    pub app_id: Uuid,
    pub participant_address: String,
    pub created_at: NaiveDateTime,
}

#[derive(Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = mpc_participants)]
pub struct MpcParticipantCreate {
    pub id: Uuid,
    pub app_id: Uuid,
    pub participant_address: String,
}

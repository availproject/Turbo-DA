use crate::schema::signer_challenges;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = signer_challenges)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct SignerChallenge {
    pub id: Uuid,
    pub user_id: String,
    pub public_address: String,
    pub nonce: Uuid,
    pub created_at: NaiveDateTime,
    pub expires_at: NaiveDateTime,
}

#[derive(Insertable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = signer_challenges)]
pub struct SignerChallengeCreate {
    pub id: Uuid,
    pub user_id: String,
    pub public_address: String,
    pub nonce: Uuid,
    pub expires_at: NaiveDateTime,
}

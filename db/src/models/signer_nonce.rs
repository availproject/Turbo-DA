use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = crate::schema::signer_nonce)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct SignerNonce {
    pub signer_address: String,
    pub last_nonce: i32,
}

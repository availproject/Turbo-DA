use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Insertable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::indexer_block_numbers)]
pub struct IndexerBlockNumbersCreate {
    pub chain_id: i32,
    pub block_number: i32,
    pub block_hash: String,
}

#[derive(Queryable, Insertable, Selectable, Serialize, Deserialize, Debug)]
#[diesel(table_name = crate::schema::indexer_block_numbers)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct IndexerBlockNumbers {
    pub id: i32,
    pub chain_id: i32,
    pub block_number: i32,
    pub block_hash: String,
}

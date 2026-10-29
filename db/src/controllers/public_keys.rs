use crate::{
    models::public_keys::{PublicKey, PublicKeyCreate},
    schema::public_keys::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use uuid::Uuid;

pub async fn add_public_key(
    conn: &mut AsyncPgConnection,
    target_user_id: &str,
    target_public_address: &str,
) -> Result<Option<PublicKey>, diesel::result::Error> {
    let new_public_key = PublicKeyCreate {
        id: Uuid::new_v4(),
        user_id: target_user_id.to_string(),
        public_address: target_public_address.to_string(),
    };

    diesel::insert_into(public_keys)
        .values(&new_public_key)
        .on_conflict(public_address)
        .do_nothing()
        .get_result(conn)
        .await
        .optional()
}

pub async fn get_public_keys_by_user(
    conn: &mut AsyncPgConnection,
    target_user_id: &str,
) -> Result<Vec<PublicKey>, diesel::result::Error> {
    public_keys
        .filter(user_id.eq(target_user_id))
        .order(created_at.desc())
        .load::<PublicKey>(conn)
        .await
}

pub async fn delete_public_key(
    conn: &mut AsyncPgConnection,
    target_user_id: &str,
    target_public_address: &str,
) -> Result<usize, diesel::result::Error> {
    diesel::delete(
        public_keys
            .filter(user_id.eq(target_user_id))
            .filter(public_address.eq(target_public_address)),
    )
    .execute(conn)
    .await
}

pub async fn public_key_exists(
    conn: &mut AsyncPgConnection,
    target_public_address: &str,
) -> Result<bool, diesel::result::Error> {
    use diesel::dsl::exists;

    diesel::select(exists(
        public_keys.filter(public_address.eq(target_public_address)),
    ))
    .get_result(conn)
    .await
}

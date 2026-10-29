use crate::{
    models::signer_challenges::{SignerChallenge, SignerChallengeCreate},
    schema::{public_keys::dsl as public_keys, signer_challenges::dsl::*},
};
use chrono::{Duration, Utc};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use uuid::Uuid;

/// Issues (or re-issues) the nonce a wallet must sign to prove ownership of an
/// address. Only one live challenge exists per (user, address).
pub async fn upsert_challenge(
    conn: &mut AsyncPgConnection,
    user: &str,
    address: &str,
    challenge_nonce: Uuid,
    ttl_secs: i64,
) -> Result<SignerChallenge, diesel::result::Error> {
    let expiry = Utc::now().naive_utc() + Duration::seconds(ttl_secs);

    let challenge = SignerChallengeCreate {
        id: Uuid::new_v4(),
        user_id: user.to_string(),
        public_address: address.to_string(),
        nonce: challenge_nonce,
        expires_at: expiry,
    };

    diesel::insert_into(signer_challenges)
        .values(&challenge)
        .on_conflict((user_id, public_address))
        .do_update()
        .set((nonce.eq(challenge_nonce), expires_at.eq(expiry)))
        .returning(SignerChallenge::as_returning())
        .get_result(conn)
        .await
}

/// Consumes the outstanding challenge for an address: the row is always
/// removed, but it is only returned when it had not expired yet.
pub async fn take_valid_challenge(
    conn: &mut AsyncPgConnection,
    user: &str,
    address: &str,
) -> Result<Option<SignerChallenge>, diesel::result::Error> {
    let taken = diesel::delete(
        signer_challenges
            .filter(user_id.eq(user))
            .filter(public_address.eq(address)),
    )
    .returning(SignerChallenge::as_returning())
    .get_result::<SignerChallenge>(conn)
    .await
    .optional()?;

    Ok(taken.filter(|challenge| challenge.expires_at > Utc::now().naive_utc()))
}

pub async fn mark_verified(
    conn: &mut AsyncPgConnection,
    address: &str,
) -> Result<usize, diesel::result::Error> {
    diesel::update(public_keys::public_keys.filter(public_keys::public_address.eq(address)))
        .set(public_keys::verified_at.eq(diesel::dsl::now))
        .execute(conn)
        .await
}

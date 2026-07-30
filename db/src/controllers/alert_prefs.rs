use crate::{
    models::alert_prefs::{UserAlertPrefs, UserAlertPrefsUpsert},
    schema::user_alert_prefs::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};

pub async fn get_prefs(
    conn: &mut AsyncPgConnection,
    user: &String,
) -> Result<Option<UserAlertPrefs>, diesel::result::Error> {
    user_alert_prefs
        .filter(user_id.eq(user))
        .select(UserAlertPrefs::as_select())
        .first::<UserAlertPrefs>(conn)
        .await
        .optional()
}

pub async fn upsert_prefs(
    conn: &mut AsyncPgConnection,
    prefs: &UserAlertPrefsUpsert,
) -> Result<UserAlertPrefs, diesel::result::Error> {
    diesel::insert_into(user_alert_prefs)
        .values(prefs)
        .on_conflict(user_id)
        .do_update()
        .set((
            low_balance_enabled.eq(prefs.low_balance_enabled),
            low_balance_credits.eq(prefs.low_balance_credits.clone()),
            runway_enabled.eq(prefs.runway_enabled),
            runway_days.eq(prefs.runway_days),
            failed_post_enabled.eq(prefs.failed_post_enabled),
            updated_at.eq(diesel::dsl::now),
        ))
        .returning(UserAlertPrefs::as_returning())
        .get_result(conn)
        .await
}

/// Stamps the last time a low balance alert went out, so the notifier does not
/// re-send on every sweep.
pub async fn mark_low_balance_alerted(
    conn: &mut AsyncPgConnection,
    user: &String,
) -> Result<usize, diesel::result::Error> {
    diesel::update(user_alert_prefs.filter(user_id.eq(user)))
        .set(low_balance_alerted_at.eq(diesel::dsl::now))
        .execute(conn)
        .await
}

/// Clears the low balance stamp once the account is topped up again.
pub async fn clear_low_balance_alert(
    conn: &mut AsyncPgConnection,
    user: &String,
) -> Result<usize, diesel::result::Error> {
    diesel::update(user_alert_prefs.filter(user_id.eq(user)))
        .set(low_balance_alerted_at.eq(None::<chrono::NaiveDateTime>))
        .execute(conn)
        .await
}

pub async fn mark_runway_alerted(
    conn: &mut AsyncPgConnection,
    user: &String,
) -> Result<usize, diesel::result::Error> {
    diesel::update(user_alert_prefs.filter(user_id.eq(user)))
        .set(runway_alerted_at.eq(diesel::dsl::now))
        .execute(conn)
        .await
}

pub async fn get_all_enabled_runway_prefs(
    conn: &mut AsyncPgConnection,
) -> Result<Vec<UserAlertPrefs>, diesel::result::Error> {
    user_alert_prefs
        .filter(runway_enabled.eq(true))
        .select(UserAlertPrefs::as_select())
        .load::<UserAlertPrefs>(conn)
        .await
}

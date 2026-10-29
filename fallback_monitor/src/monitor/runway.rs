/// Daily sweep that warns users whose credits are due to run out.
///
/// Runway is a projection, not a threshold on a stored value, so unlike the
/// low balance alert there is nothing to latch on a balance change: it is
/// recomputed on a schedule and re-sent at most weekly.
use bigdecimal::{BigDecimal, RoundingMode, ToPrimitive};
use chrono::{Duration, Utc};
use db::{
    controllers::{
        alert_prefs::{get_all_enabled_runway_prefs, mark_runway_alerted},
        customer_expenditure::usage_summary,
        users::get_user,
    },
    models::alert_prefs::UserAlertPrefs,
};
use diesel_async::{AsyncConnection, AsyncPgConnection};

/// Trailing window used to estimate the burn rate.
const BURN_WINDOW_DAYS: i32 = 7;

/// A user who stays below their runway threshold is reminded weekly rather
/// than on every daily sweep.
const REALERT_AFTER_DAYS: i64 = 7;

pub async fn check_runway_alerts(database_url: &str) {
    let notifier = notifier::shared();
    if !notifier.enabled() {
        return;
    }

    let mut connection = match AsyncPgConnection::establish(database_url).await {
        Ok(connection) => connection,
        Err(e) => {
            tracing::error!(error = %e, "couldn't connect to db for runway alerts");
            return;
        }
    };

    let prefs_list = match get_all_enabled_runway_prefs(&mut connection).await {
        Ok(prefs_list) => prefs_list,
        Err(e) => {
            tracing::error!(error = %e, "couldn't load runway alert preferences");
            return;
        }
    };

    tracing::info!(users = prefs_list.len(), "checking runway alerts");

    // Sequential and individually fallible: one user whose usage or balance
    // cannot be read must not stop the rest of the sweep.
    for prefs in prefs_list {
        check_one(&mut connection, &prefs).await;
    }
}

async fn check_one(connection: &mut AsyncPgConnection, prefs: &UserAlertPrefs) {
    let user_id = &prefs.user_id;

    let Some(threshold_days) = prefs.runway_days else {
        return;
    };
    if threshold_days <= 0 {
        return;
    }

    if let Some(alerted_at) = prefs.runway_alerted_at {
        if Utc::now().naive_utc() - alerted_at < Duration::days(REALERT_AFTER_DAYS) {
            return;
        }
    }

    let usage = match usage_summary(connection, user_id, BURN_WINDOW_DAYS).await {
        Ok(usage) => usage,
        Err(e) => {
            tracing::warn!(error = %e, user_id = %user_id, "couldn't load usage for runway alert");
            return;
        }
    };

    // No spend in the window means no meaningful projection.
    if usage.spent_credits <= BigDecimal::from(0) {
        return;
    }

    let user = match get_user(connection, user_id).await {
        Ok(user) => user,
        Err(e) => {
            tracing::warn!(error = %e, user_id = %user_id, "couldn't load user for runway alert");
            return;
        }
    };

    // balance / (spend / window), kept as one division to avoid rounding the
    // daily burn before it is used as a divisor.
    let runway_days = (&user.credit_balance * BigDecimal::from(BURN_WINDOW_DAYS)
        / &usage.spent_credits)
        .with_scale_round(0, RoundingMode::Down)
        .to_i64()
        .unwrap_or(i64::MAX);

    if runway_days >= threshold_days as i64 {
        return;
    }

    tracing::info!(
        user_id = %user_id,
        runway_days,
        threshold_days,
        "sending runway alert"
    );

    match notifier::shared()
        .send_runway_alert(
            user_id,
            runway_days,
            threshold_days,
            &notifier::format_credits(&user.credit_balance),
        )
        .await
    {
        Ok(()) => {
            if let Err(e) = mark_runway_alerted(connection, user_id).await {
                tracing::warn!(error = %e, user_id = %user_id, "couldn't record runway alert");
            }
        }
        Err(e) => {
            tracing::warn!(error = %e, user_id = %user_id, "couldn't send runway alert");
        }
    }
}

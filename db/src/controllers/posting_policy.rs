use crate::{
    models::app_allowed_avail_ids::AppAllowedAvailIdCreate,
    schema::{app_allowed_avail_ids::dsl as allowed, apps::dsl as apps},
};
use diesel::prelude::*;
use diesel_async::{
    scoped_futures::ScopedFutureExt, AsyncConnection, AsyncPgConnection, RunQueryDsl,
};
use uuid::Uuid;

/// Returns whether an app lets callers choose the Avail app id per post, along
/// with the ids they are allowed to choose from.
pub async fn get_policy(
    conn: &mut AsyncPgConnection,
    app_uuid: &Uuid,
) -> Result<(bool, Vec<i32>), diesel::result::Error> {
    let per_post = apps::apps
        .filter(apps::id.eq(app_uuid))
        .select(apps::per_post_app_id)
        .first::<bool>(conn)
        .await?;

    let allowed_ids = get_allowed_ids(conn, app_uuid).await?;

    Ok((per_post, allowed_ids))
}

pub async fn get_allowed_ids(
    conn: &mut AsyncPgConnection,
    app_uuid: &Uuid,
) -> Result<Vec<i32>, diesel::result::Error> {
    allowed::app_allowed_avail_ids
        .filter(allowed::app_id.eq(app_uuid))
        .order(allowed::avail_app_id.asc())
        .select(allowed::avail_app_id)
        .load::<i32>(conn)
        .await
}

/// Replaces the posting policy for an app the user owns.
///
/// Returns `Error::NotFound` when the app does not belong to `user`.
pub async fn set_policy(
    conn: &mut AsyncPgConnection,
    user: &String,
    app_uuid: &Uuid,
    per_post: bool,
    allowed_ids: Vec<i32>,
) -> Result<(), diesel::result::Error> {
    let app_uuid = *app_uuid;

    conn.transaction(|conn| {
        async move {
            apps::apps
                .filter(apps::id.eq(&app_uuid))
                .filter(apps::user_id.eq(user))
                .select(apps::id)
                .first::<Uuid>(conn)
                .await?;

            diesel::update(apps::apps.filter(apps::id.eq(&app_uuid)))
                .set(apps::per_post_app_id.eq(per_post))
                .execute(conn)
                .await?;

            diesel::delete(allowed::app_allowed_avail_ids.filter(allowed::app_id.eq(&app_uuid)))
                .execute(conn)
                .await?;

            let new_entries: Vec<AppAllowedAvailIdCreate> = allowed_ids
                .into_iter()
                .map(|avail_id| AppAllowedAvailIdCreate {
                    app_id: app_uuid,
                    avail_app_id: avail_id,
                })
                .collect();

            if !new_entries.is_empty() {
                diesel::insert_into(allowed::app_allowed_avail_ids)
                    .values(&new_entries)
                    .on_conflict((allowed::app_id, allowed::avail_app_id))
                    .do_nothing()
                    .execute(conn)
                    .await?;
            }

            Ok(())
        }
        .scope_boxed()
    })
    .await
}

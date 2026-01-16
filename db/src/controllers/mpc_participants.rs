use crate::{
    models::mpc_participants::{MpcParticipant, MpcParticipantCreate},
    schema::mpc_participants::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use uuid::Uuid;

pub async fn add_participant(
    conn: &mut AsyncPgConnection,
    target_app_id: &Uuid,
    target_participant_address: &str,
) -> Result<Option<MpcParticipant>, diesel::result::Error> {
    let new_participant = MpcParticipantCreate {
        id: Uuid::new_v4(),
        app_id: *target_app_id,
        participant_address: target_participant_address.to_string(),
    };

    diesel::insert_into(mpc_participants)
        .values(&new_participant)
        .on_conflict((app_id, participant_address))
        .do_nothing()
        .get_result(conn)
        .await
        .optional()
}

pub async fn add_participants(
    conn: &mut AsyncPgConnection,
    target_app_id: &Uuid,
    participants_list: Vec<String>,
) -> Result<Vec<MpcParticipant>, diesel::result::Error> {
    let new_participants: Vec<MpcParticipantCreate> = participants_list
        .into_iter()
        .map(|addr| MpcParticipantCreate {
            id: Uuid::new_v4(),
            app_id: *target_app_id,
            participant_address: addr,
        })
        .collect();

    diesel::insert_into(mpc_participants)
        .values(&new_participants)
        .on_conflict((app_id, participant_address))
        .do_nothing()
        .get_results(conn)
        .await
}

pub async fn delete_participant(
    conn: &mut AsyncPgConnection,
    target_app_id: &Uuid,
    target_participant_address: &str,
) -> Result<usize, diesel::result::Error> {
    diesel::delete(
        mpc_participants
            .filter(app_id.eq(target_app_id))
            .filter(participant_address.eq(target_participant_address)),
    )
    .execute(conn)
    .await
}

pub async fn delete_participants(

    conn: &mut AsyncPgConnection,

    target_app_id: &Uuid,

    participants_list: Vec<String>,

) -> Result<usize, diesel::result::Error> {

    diesel::delete(

        mpc_participants

            .filter(app_id.eq(target_app_id))

            .filter(participant_address.eq_any(participants_list)),

    )

    .execute(conn)

    .await

}



pub async fn get_apps_by_participant(

    conn: &mut AsyncPgConnection,

    target_participant_address: &str,

) -> Result<Vec<crate::models::apps::Apps>, diesel::result::Error> {

    use crate::schema::apps;



        mpc_participants



            .inner_join(apps::table)



            .filter(participant_address.eq(target_participant_address))



            .select(crate::models::apps::Apps::as_select())



            .load::<crate::models::apps::Apps>(conn)



            .await



    }



    

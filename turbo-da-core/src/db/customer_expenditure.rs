use actix_web::HttpResponse;
use customer_expenditure::CustomerExpenditureGet;
use db::{models::*, schema::customer_expenditures::dsl::*};
use diesel::{prelude::*, result::Error};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::{error, info};
use serde_json::json;
use uuid::Uuid;

pub async fn handle_submission_info(
    connection: &mut AsyncPgConnection,
    submission_id: Uuid,
) -> HttpResponse {
    match customer_expenditures
        .filter(id.eq(submission_id))
        .select(CustomerExpenditureGet::as_select())
        .first::<CustomerExpenditureGet>(connection)
        .await
    {
        Ok(sub) => HttpResponse::Ok().json(json!({"submission": sub})),
        Err(Error::NotFound) => {
            HttpResponse::NotFound().body("Customer Expenditure entry not found")
        }
        Err(_) => HttpResponse::InternalServerError().body("Database error"),
    }
}

pub async fn handle_get_all_expenditure(
    connection: &mut AsyncPgConnection,
    user: String,
    final_limit: i64,
) -> HttpResponse {
    match customer_expenditures
        .filter(user_id.eq(user))
        .limit(final_limit)
        .select(CustomerExpenditureGet::as_select())
        .load(connection)
        .await
    {
        Ok(results) => HttpResponse::Ok().json(json!({"results":results})),
        Err(_) => HttpResponse::InternalServerError()
            .body("Database error: Couldn't fetch customer_expenditure entry"),
    }
}

pub async fn add_error_entry(sub_id: &Uuid, e: String, connection: &mut AsyncPgConnection) {
    let update_values = (error.eq(e.to_string()),);

    let tx = diesel::update(customer_expenditures.filter(id.eq(sub_id)))
        .set(update_values)
        .execute(connection)
        .await;

    match tx {
        Ok(_) => {
            info!("Error logged updated for submission id {:?} ", sub_id);
        }
        Err(e) => {
            error!("Couldn't insert error log value. Error: {:?}", e);
        }
    }
}

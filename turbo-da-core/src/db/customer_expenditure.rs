use actix_web::HttpResponse;
use bigdecimal::BigDecimal;
use customer_expenditure::{CreateCustomerExpenditure, CustomerExpenditureGet};
use db::{models::*, schema::customer_expenditures::dsl::*};
use diesel::{prelude::*, result::Error};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::{error, info};
use serde_json::json;
use uuid::Uuid;

use crate::avail::submit_data::TransactionInfo;
pub async fn handle_get_customer_expenditure_using_token_id(
    connection: &mut AsyncPgConnection,
    user: String,
    token: i32,
) -> HttpResponse {
    match customer_expenditures
        .filter(user_id.eq(user))
        .filter(token_details_id.eq(token))
        .select(CustomerExpenditureGet::as_select())
        .first::<CustomerExpenditureGet>(connection)
        .await
    {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(Error::NotFound) => HttpResponse::NotFound().body("User not found"),
        Err(_) => HttpResponse::InternalServerError().body("Database error"),
    }
}
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

pub async fn update_customer_expenditure(
    result: TransactionInfo,
    fees_as_bigdecimal: &BigDecimal,
    fees_as_bigdecimal_in_avail: &BigDecimal,
    submission_id: Uuid,
    connection: &mut AsyncPgConnection,
) {
    let update_values = (
        fees.eq(fees_as_bigdecimal),
        converted_fees.eq(fees_as_bigdecimal_in_avail),
        to_address.eq(Some(result.to_address)),
        block_hash.eq(Some(result.block_hash)),
        data_hash.eq(Some(result.data_hash)),
        tx_hash.eq(Some(result.tx_hash)),
        extrinsic_index.eq(Some(result.extrinsic_index as i32)),
        block_number.eq(Some(result.block_number as i32)),
        payload.eq(None::<Vec<u8>>),
    );

    let tx = diesel::update(customer_expenditures.filter(id.eq(submission_id)))
        .set(update_values.clone())
        .execute(connection)
        .await;

    match tx {
        Ok(_) => {
            info!("Entry updated for submission id {:?} ", submission_id);
        }
        Err(e) => {
            error!(
                "Couldn't insert customer expenditure entry {:?}. Error: {:?}",
                update_values, e
            );
        }
    }
}

pub async fn create_customer_expenditure_entry(
    connection: &mut AsyncPgConnection,
    customer_expendire_entry: CreateCustomerExpenditure,
) {
    match diesel::insert_into(customer_expenditures)
        .values(&customer_expendire_entry)
        .execute(connection)
        .await
    {
        Ok(_) => {
            info!(
                "Customer Expenditure entry created {}",
                &customer_expendire_entry.id
            );
        }
        Err(e) => {
            error!(
                "Couldn't create a new customer expenditure entry with submission id {}. Error {:?}",
                customer_expendire_entry.id, e
            );
        }
    };
}

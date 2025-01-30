use actix_web::HttpResponse;
use bigdecimal::BigDecimal;
use customer_expenditure::CreateCustomerExpenditure;
use db::{models::*, schema::customer_expenditures::dsl::*};
use diesel::{prelude::*, result::Error};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::{error, info};
use serde_json::json;
use uuid::Uuid;

use crate::avail::submit_data::TransactionInfo;

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
        error.eq(None::<String>),
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

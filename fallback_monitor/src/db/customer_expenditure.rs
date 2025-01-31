use db::{
    models::customer_expenditure::CustomerExpenditureGetWithPayload,
    schema::customer_expenditures::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::error;
use uuid::Uuid;
pub async fn get_unresolved_transactions(
    connection: &mut AsyncPgConnection,
    retry: i32,
) -> Result<Vec<CustomerExpenditureGetWithPayload>, String> {
    match customer_expenditures
        .filter(error.is_not_null())
        .or_filter(payload.is_not_null())
        .filter(retry_count.lt(retry))
        .order(created_at.desc())
        .select(CustomerExpenditureGetWithPayload::as_select())
        .load(connection)
        .await
    {
        Ok(list) => Ok(list),
        Err(_) => Err("DB Call Error".to_string()),
    }
}

pub async fn increase_retry_count(
    entry_id: Uuid,
    connection: &mut AsyncPgConnection,
) -> Result<(), String> {
    match diesel::update(customer_expenditures.filter(id.eq(entry_id)))
        .set(retry_count.eq(retry_count + 1))
        .execute(connection)
        .await
    {
        Ok(size) => {
            if size == 0 {
                error!(
                    "Failed to increase retry count for entry id: {:?}",
                    entry_id
                );
                return Err("Failed to increase retry count for entry id".to_string());
            }
            Ok(())
        }
        Err(e) => {
            error!("Failed to increase retry count for entry id: {:?}", e);
            return Err("Failed to increase retry count for entry id".to_string());
        }
    }
}

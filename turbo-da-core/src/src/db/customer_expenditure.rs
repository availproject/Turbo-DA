use db::{
    models::customer_expenditure::CustomerExpenditureGetWithPayload,
    schema::customer_expenditures::dsl::*,
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
pub async fn get_unresolved_transactions(
    connection: &mut AsyncPgConnection,
) -> Result<Vec<CustomerExpenditureGetWithPayload>, String> {
    match customer_expenditures
        .filter(error.is_not_null())
        .order(created_at.desc())
        .select(CustomerExpenditureGetWithPayload::as_select())
        .load(connection)
        .await
    {
        Ok(list) => Ok(list),
        Err(_) => Err("DB Call Error".to_string()),
    }
}

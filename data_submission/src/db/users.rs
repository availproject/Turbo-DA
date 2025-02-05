use bigdecimal::BigDecimal;
use db::schema::users::dsl::*;
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use log::{error, info};

/// Parameters for transaction details
#[derive(Clone)]
pub struct TxParams {
    pub amount_data: String,
    pub amount_data_billed: BigDecimal,
    pub fees: u128,
}

pub async fn update_credit_balance(
    connection: &mut AsyncPgConnection,
    user_id: &String,
    tx_params: &TxParams,
) {
    let tx = diesel::update(users.find(&user_id))
        .set((
            credit_balance.eq(credit_balance - &tx_params.amount_data_billed),
            credit_used.eq(credit_used + &tx_params.amount_data_billed),
        ))
        .execute(connection)
        .await;

    match tx {
        Ok(_) => {
            info!(
                "Entry updated with credits deduction {:?} ",
                tx_params.amount_data_billed
            );
        }
        Err(e) => {
            error!(
                "Couldn't insert update fee information entry for token details id {:?}, fee: {:?}. Error {:?}",
                user_id, tx_params.fees, e
            );
        }
    }
}

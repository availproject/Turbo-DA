use crate::controllers::token_balances::CombinedTokenInfo;
use db::{
    models::{token_balances::TokenBalances, user_model::User},
    schema::{fund_requests, token_balances::dsl::*, users::table as users},
};
use diesel::prelude::*;
use diesel_async::{AsyncPgConnection, RunQueryDsl};

pub async fn get_all_token_balances(
    connection: &mut AsyncPgConnection,
    user: String,
    final_limit: i64,
) -> Vec<TokenBalances> {
    token_balances
        .filter(user_id.eq(user))
        .limit(final_limit)
        .select(TokenBalances::as_select())
        .load(connection)
        .await
        .expect("Error loading users")
}

pub async fn get_all_token_balances_with_chain_id(
    connection: &mut AsyncPgConnection,
    user: String,
    final_limit: i64,
) -> Vec<CombinedTokenInfo> {
    let results = token_balances
        .left_join(
            fund_requests::table.on(token_address
                .eq(fund_requests::token_address)
                .and(user_id.eq(fund_requests::user_id))),
        )
        .filter(user_id.eq(user))
        .limit(final_limit)
        .select((
            TokenBalances::as_select(),
            fund_requests::chain_id.nullable(),
        ))
        .load::<(TokenBalances, Option<i32>)>(&mut *connection)
        .await
        .expect("Error loading users");

    results
        .into_iter()
        .map(|(token_bal, chain_id_joined)| CombinedTokenInfo {
            token_details_id: token_bal.token_details_id,
            user_id: token_bal.user_id,
            token_address: token_bal.token_address,
            token_balance: token_bal.token_balance,
            chain_id: chain_id_joined,
        })
        .collect()
}

pub async fn validate_and_get_entries(
    connection: &mut AsyncPgConnection,
    user: &String,
    token_addr: &String,
) -> Result<(i32, i32), String> {
    let query: Result<(TokenBalances, User), diesel::result::Error> = token_balances
        .inner_join(users)
        .filter(db::schema::users::id.eq(user))
        .filter(db::schema::token_balances::token_address.eq(token_addr))
        .select((TokenBalances::as_select(), User::as_select()))
        .first::<(TokenBalances, User)>(connection)
        .await;

    match query {
        Ok(info) => Ok((info.1.app_id, info.0.token_details_id)),
        Err(e) => Err(format!("Error retrieving user balance: {}", e)),
    }
}

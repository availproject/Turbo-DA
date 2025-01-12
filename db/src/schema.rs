// @generated automatically by Diesel CLI.

diesel::table! {
    customer_expenditures (id) {
        id -> Uuid,
        user_id -> Varchar,
        token_details_id -> Int4,
        amount_data -> Varchar,
        fees -> Nullable<Numeric>,
        converted_fees -> Nullable<Numeric>,
        to_address -> Nullable<Varchar>,
        block_number -> Nullable<Int4>,
        block_hash -> Nullable<Varchar>,
        extrinsic_index -> Nullable<Int4>,
        data_hash -> Nullable<Varchar>,
        tx_hash -> Nullable<Varchar>,
        created_at -> Timestamp,
        payment_token -> Varchar,
        error -> Nullable<Varchar>,
        payload -> Nullable<Bytea>,
    }
}

diesel::table! {
    fund_requests (id) {
        id -> Int4,
        user_id -> Varchar,
        #[max_length = 50]
        token_address -> Varchar,
        amount_token -> Numeric,
        chain_id -> Int4,
        #[max_length = 50]
        request_status -> Varchar,
        created_at -> Timestamp,
        tx_hash -> Varchar,
        #[max_length = 50]
        request_type -> Varchar,
    }
}

diesel::table! {
    indexer_block_numbers (id) {
        id -> Int4,
        chain_id -> Int4,
        block_number -> Int4,
        block_hash -> Varchar,
        created_at -> Timestamp,
    }
}

diesel::table! {
    signer_nonce (id) {
        id -> Int4,
        signer_address -> Varchar,
        last_nonce -> Int4,
    }
}

diesel::table! {
    token_balances (token_details_id) {
        token_details_id -> Int4,
        user_id -> Varchar,
        #[max_length = 50]
        token_address -> Varchar,
        token_balance -> Numeric,
        token_used -> Numeric,
        token_amount_locked -> Numeric,
    }
}

diesel::table! {
    users (id) {
        id -> Varchar,
        name -> Varchar,
        email -> Varchar,
        app_id -> Int4,
        assigned_wallet -> Varchar,
    }
}

diesel::joinable!(customer_expenditures -> users (user_id));
diesel::joinable!(fund_requests -> users (user_id));
diesel::joinable!(token_balances -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    customer_expenditures,
    fund_requests,
    indexer_block_numbers,
    signer_nonce,
    token_balances,
    users,
);

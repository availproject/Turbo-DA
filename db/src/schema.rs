// @generated automatically by Diesel CLI.

diesel::table! {
    api_keys (api_key) {
        #[max_length = 255]
        api_key -> Varchar,
        created_at -> Timestamp,
        #[max_length = 255]
        user_id -> Varchar,
        #[max_length = 255]
        identifier -> Varchar,
    }
}

diesel::table! {
    credit_requests (id) {
        id -> Int4,
        user_id -> Varchar,
        amount_credit -> Numeric,
        chain_id -> Nullable<Int4>,
        #[max_length = 50]
        request_status -> Varchar,
        created_at -> Timestamp,
        tx_hash -> Nullable<Varchar>,
        #[max_length = 50]
        request_type -> Varchar,
    }
}

diesel::table! {
    customer_expenditures (id) {
        id -> Uuid,
        user_id -> Varchar,
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
        error -> Nullable<Varchar>,
        payload -> Nullable<Bytea>,
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
    users (id) {
        id -> Varchar,
        name -> Varchar,
        email -> Varchar,
        app_id -> Int4,
        credit_balance -> Numeric,
        credit_used -> Numeric,
    }
}

diesel::joinable!(api_keys -> users (user_id));
diesel::joinable!(credit_requests -> users (user_id));
diesel::joinable!(customer_expenditures -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    api_keys,
    credit_requests,
    customer_expenditures,
    indexer_block_numbers,
    signer_nonce,
    users,
);

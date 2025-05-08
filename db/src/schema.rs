// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "fallback_status"))]
    pub struct FallbackStatus;
}

diesel::table! {
    api_keys (api_key) {
        #[max_length = 255]
        api_key -> Varchar,
        created_at -> Timestamp,
        #[max_length = 255]
        user_id -> Varchar,
        #[max_length = 255]
        identifier -> Varchar,
        app_id -> Uuid,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::FallbackStatus;

    apps (id) {
        id -> Uuid,
        user_id -> Varchar,
        app_id -> Int4,
        app_name -> Nullable<Varchar>,
        app_description -> Nullable<Varchar>,
        app_logo -> Nullable<Varchar>,
        credit_balance -> Numeric,
        credit_used -> Numeric,
        fallback_enabled -> Bool,
        fallback_updated_at -> Array<Nullable<FallbackStatus>>,
        metadata_path -> Nullable<Varchar>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    credit_requests (id) {
        id -> Int4,
        user_id -> Varchar,
        amount_credit -> Nullable<Numeric>,
        chain_id -> Nullable<Int4>,
        #[max_length = 50]
        request_status -> Varchar,
        created_at -> Timestamp,
        tx_hash -> Nullable<Varchar>,
        #[max_length = 50]
        request_type -> Varchar,
        updated_at -> Timestamp,
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
        retry_count -> Int4,
        error -> Nullable<Varchar>,
        payload -> Nullable<Bytea>,
        updated_at -> Timestamp,
        app_id -> Uuid,
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
    users (id) {
        id -> Varchar,
        name -> Varchar,
        credit_balance -> Numeric,
        credit_used -> Numeric,
        allocated_credit_balance -> Numeric,
    }
}

diesel::joinable!(api_keys -> apps (app_id));
diesel::joinable!(api_keys -> users (user_id));
diesel::joinable!(apps -> users (user_id));
diesel::joinable!(credit_requests -> users (user_id));
diesel::joinable!(customer_expenditures -> apps (app_id));
diesel::joinable!(customer_expenditures -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    api_keys,
    apps,
    credit_requests,
    customer_expenditures,
    indexer_block_numbers,
    users,
);

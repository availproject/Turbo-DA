-- Your SQL goes here
CREATE TABLE failed_transactions(
    submission_id UUID PRIMARY KEY,
    payload_size VARCHAR NOT NULL,
    payload BYTEA NOT NULL,
    user_id VARCHAR NOT NULL,
    token_details_id INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
-- Your SQL goes here
CREATE TABLE customer_expenditures (
    id UUID UNIQUE PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    token_details_id INTEGER NOT NULL, 
    amount_data VARCHAR NOT NULL,
    fees NUMERIC(39, 0),
    converted_fees NUMERIC(39, 0),
    to_address VARCHAR,
    block_number INTEGER,
    block_hash VARCHAR,
    extrinsic_index INTEGER,
    data_hash VARCHAR,
    tx_hash VARCHAR,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    payment_token VARCHAR NOT NULL,
    error VARCHAR,
    payload BYTEA,
    FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (token_details_id, user_id) REFERENCES token_balances(token_details_id, user_id) ON DELETE CASCADE
);


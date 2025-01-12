-- Your SQL goes here
CREATE TABLE token_balances (
    token_details_id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    token_address VARCHAR(50) NOT NULL,
    token_balance NUMERIC(39, 0) NOT NULL,
    token_used NUMERIC(39, 0) NOT NULL DEFAULT 0,
    token_amount_locked NUMERIC(39, 0) NOT NULL DEFAULT 0,
    UNIQUE(user_id, token_address),
    UNIQUE(user_id, token_details_id),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

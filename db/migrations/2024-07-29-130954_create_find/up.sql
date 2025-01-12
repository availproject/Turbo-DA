-- Your SQL goes here
CREATE TABLE fund_requests (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    token_address VARCHAR(50) NOT NULL,
    amount_token DECIMAL NOT NULL,
    chain_id INTEGER NOT NULL,
    request_status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tx_hash VARCHAR NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    UNIQUE(chain_id, tx_hash),
    FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (token_address, user_id) REFERENCES token_balances(token_address, user_id) ON DELETE CASCADE
);
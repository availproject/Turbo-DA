-- Your SQL goes here
CREATE TABLE IF NOT EXISTS credit_requests (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    amount_credit DECIMAL NOT NULL,
    chain_id INTEGER,
    request_status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tx_hash VARCHAR,
    request_type VARCHAR(50) NOT NULL,
    UNIQUE(chain_id, tx_hash),
    FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

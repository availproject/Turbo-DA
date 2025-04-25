-- Your SQL goes here
CREATE TABLE users (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    app_id INTEGER NOT NULL,
    credit_balance NUMERIC(39, 0) NOT NULL DEFAULT 0,
    credit_used NUMERIC(39, 0) NOT NULL DEFAULT 0,
);

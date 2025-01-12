-- Your SQL goes here
CREATE TABLE users (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    app_id INTEGER NOT NULL,
    assigned_wallet VARCHAR NOT NULL
);

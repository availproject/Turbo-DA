-- Your SQL goes here
CREATE TABLE IF NOT EXISTS api_keys (
    api_key VARCHAR(255) PRIMARY KEY ,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
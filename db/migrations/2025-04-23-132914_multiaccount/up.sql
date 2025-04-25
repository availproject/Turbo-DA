-- Your SQL goes here
ALTER TABLE api_keys 
ADD COLUMN account_id UUID NOT NULL,
ADD CONSTRAINT fk_api_keys_account_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE users
ADD COLUMN allocated_credit_balance NUMERIC(39, 0) NOT NULL DEFAULT 0;



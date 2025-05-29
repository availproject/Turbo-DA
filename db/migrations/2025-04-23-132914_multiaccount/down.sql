ALTER TABLE customer_expenditures
DROP COLUMN app_id,
DROP COLUMN updated_at,
DROP COLUMN wallet;

ALTER TABLE credit_requests
DROP COLUMN app_id,
DROP COLUMN updated_at,
DROP COLUMN token_address;

ALTER TABLE api_keys DROP CONSTRAINT fk_api_keys_app_id;
ALTER TABLE api_keys DROP COLUMN app_id;

ALTER TABLE users DROP COLUMN allocated_credit_balance;

ALTER TABLE users
ADD COLUMN app_id NUMERIC(39, 0);


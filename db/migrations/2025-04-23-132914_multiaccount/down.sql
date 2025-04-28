-- This file should undo anything in `up.sql`
ALTER TABLE api_keys DROP CONSTRAINT fk_api_keys_account_id;
ALTER TABLE api_keys DROP COLUMN account_id;

ALTER TABLE users DROP COLUMN allocated_credit_balance;

-- Your SQL goes here

ALTER TABLE apps
ADD COLUMN credit_selection SMALLINT DEFAULT 0 
CHECK (credit_selection IN (0, 1, 2));

UPDATE apps 
SET credit_selection = CASE 
    WHEN fallback_enabled = TRUE THEN 1
END;

ALTER TABLE apps
DROP COLUMN fallback_enabled;

ALTER TABLE customer_expenditures
ADD COLUMN ciphertext_hash BYTEA,
ADD COLUMN plaintext_hash BYTEA,
ADD COLUMN signature_ciphertext_hash BYTEA,
ADD COLUMN signature_plaintext_hash BYTEA,
ADD COLUMN address BYTEA,
ADD COLUMN ephemeral_pub_key BYTEA;

ALTER TABLE users 
ADD COLUMN sumsub_timestamp TIMESTAMP;

ALTER TABLE apps
ADD COLUMN encrypted_data BOOLEAN NOT NULL DEFAULT FALSE;
-- Your SQL goes here
ALTER TABLE apps
ADD COLUMN encryption BOOLEAN DEFAULT FALSE;

UPDATE apps
SET encryption = FALSE;

ALTER TABLE apps
ALTER COLUMN encryption SET NOT NULL;

ALTER TABLE customer_expenditures
ADD COLUMN ciphertext_hash BYTEA,
ADD COLUMN plaintext_hash BYTEA,
ADD COLUMN signature_ciphertext_hash BYTEA,
ADD COLUMN signature_plaintext_hash BYTEA,
ADD COLUMN address BYTEA,
ADD COLUMN ephemeral_pub_key BYTEA;

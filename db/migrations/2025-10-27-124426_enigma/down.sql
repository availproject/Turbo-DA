ALTER TABLE customer_expenditures
DROP COLUMN ciphertext_hash,
DROP COLUMN plaintext_hash,
DROP COLUMN signature_ciphertext_hash,
DROP COLUMN signature_plaintext_hash,
DROP COLUMN address,
DROP COLUMN ephemeral_pub_key;

ALTER TABLE apps
DROP COLUMN encryption;
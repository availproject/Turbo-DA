-- This file should undo anything in `up.sql`

ALTER TABLE customer_expenditures
DROP COLUMN source;

DROP INDEX address_book_user_address_idx;

DROP TABLE address_book;

DROP TABLE user_alert_prefs;

DROP TABLE signer_challenges;

ALTER TABLE public_keys
DROP COLUMN verified_at;

DROP TABLE app_allowed_avail_ids;

ALTER TABLE apps
DROP COLUMN per_post_app_id;

ALTER TABLE api_keys
DROP COLUMN label,
DROP COLUMN last_used_at;

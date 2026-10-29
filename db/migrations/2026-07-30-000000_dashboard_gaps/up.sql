-- Your SQL goes here

-- API key metadata: human readable label and last usage timestamp
ALTER TABLE api_keys
ADD COLUMN label VARCHAR(64),
ADD COLUMN last_used_at TIMESTAMP;

-- Posting policy: allow callers to pick the Avail app id per post
ALTER TABLE apps
ADD COLUMN per_post_app_id BOOLEAN DEFAULT FALSE;

UPDATE apps
SET per_post_app_id = FALSE;

ALTER TABLE apps
ALTER COLUMN per_post_app_id SET NOT NULL;

CREATE TABLE app_allowed_avail_ids (
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    avail_app_id INT4 NOT NULL,
    PRIMARY KEY (app_id, avail_app_id)
);

-- Signer verification
ALTER TABLE public_keys
ADD COLUMN verified_at TIMESTAMP;

CREATE TABLE signer_challenges (
    id UUID PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_address VARCHAR NOT NULL,
    nonce UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(user_id, public_address)
);

-- Alert preferences
CREATE TABLE user_alert_prefs (
    user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    low_balance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    low_balance_credits NUMERIC,
    runway_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    runway_days INT4,
    failed_post_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    low_balance_alerted_at TIMESTAMP,
    runway_alerted_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Address book
CREATE TABLE address_book (
    id UUID PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR NOT NULL,
    name VARCHAR(64) NOT NULL,
    role VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX address_book_user_address_idx ON address_book (user_id, lower(address));

-- Origin of a submission, 'playground' when posted from the dashboard
ALTER TABLE customer_expenditures
ADD COLUMN source VARCHAR;

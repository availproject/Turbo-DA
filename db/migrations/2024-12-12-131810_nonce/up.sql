CREATE TABLE IF NOT EXISTS signer_nonce (
    id SERIAL PRIMARY KEY, -- Unique ID to ensure single row
    signer_address VARCHAR NOT NULL,
    last_nonce INTEGER NOT NULL,
    UNIQUE(signer_address)
);


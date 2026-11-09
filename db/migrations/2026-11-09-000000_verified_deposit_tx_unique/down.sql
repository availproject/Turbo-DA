DROP INDEX credit_requests_credited_chain_id_tx_hash_key;

ALTER TABLE credit_requests
    ADD CONSTRAINT credit_requests_chain_id_tx_hash_key UNIQUE (chain_id, tx_hash);

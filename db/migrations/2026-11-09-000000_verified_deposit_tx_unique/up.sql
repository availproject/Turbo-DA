-- tx_hash on an uncredited order is an unverified client report, so it must not reserve the hash.
ALTER TABLE credit_requests DROP CONSTRAINT credit_requests_chain_id_tx_hash_key;

CREATE UNIQUE INDEX credit_requests_credited_chain_id_tx_hash_key
    ON credit_requests (chain_id, tx_hash)
    WHERE amount_credit IS NOT NULL;

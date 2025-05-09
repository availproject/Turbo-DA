
ALTER TABLE api_keys 
ADD COLUMN app_id UUID,
ADD CONSTRAINT fk_api_keys_app_id FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE users
ADD COLUMN allocated_credit_balance NUMERIC(39, 0) NOT NULL DEFAULT 0;


INSERT INTO apps (
    id, 
    user_id, 
    app_id,
    credit_balance, 
    credit_used, 
    fallback_enabled, 
    fallback_updated_at,
    created_at, 
    updated_at
)
SELECT 
    gen_random_uuid(), 
    id,                 
    app_id,  
    0,                  -- default credit_balance
    0,                  -- default credit_used
    TRUE,               -- default fallback_enabled
    ARRAY[ROW(CURRENT_TIMESTAMP, TRUE)::fallback_status],
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP          
FROM users;


ALTER TABLE users
DROP COLUMN app_id;

ALTER TABLE customer_expenditures
ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
ADD COLUMN app_id UUID;

UPDATE customer_expenditures
SET app_id = apps.id
FROM apps
WHERE customer_expenditures.user_id = apps.user_id;

ALTER TABLE customer_expenditures
ADD CONSTRAINT fk_customer_expenditure_app_id FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE credit_requests
ADD COLUMN app_id UUID,
ALTER COLUMN amount_credit DROP NOT NULL,
ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
ADD CONSTRAINT fk_credit_requests_app_id FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE api_keys
SET app_id = apps.id
FROM apps
WHERE api_keys.user_id = apps.user_id;

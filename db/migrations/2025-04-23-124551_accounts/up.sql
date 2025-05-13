CREATE TYPE fallback_status AS (
    updated_at TIMESTAMP WITH TIME ZONE,
    value BOOLEAN
);

CREATE TYPE assigned_credits_log AS (
    credit_balance_original NUMERIC(39, 0),
    credit_balance_used_original NUMERIC(39, 0),
    credits_added NUMERIC(39, 0),
    created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE apps ( 
    id UUID UNIQUE PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    app_id INTEGER NOT NULL,
    app_name VARCHAR,
    app_description VARCHAR,
    app_logo VARCHAR,
    credit_balance NUMERIC(39, 0) NOT NULL DEFAULT 0,
    credit_used NUMERIC(39, 0) NOT NULL DEFAULT 0,
    fallback_credit_used NUMERIC(39, 0) NOT NULL DEFAULT 0,
    fallback_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    fallback_updated_at fallback_status[],
    assigned_credits_logs assigned_credits_log[],
    metadata_path VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);




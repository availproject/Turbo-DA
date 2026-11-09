-- Rows written before this column existed were submitted on infinity.
ALTER TABLE customer_expenditures ADD COLUMN infinity BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE customer_expenditures ALTER COLUMN infinity SET DEFAULT FALSE;

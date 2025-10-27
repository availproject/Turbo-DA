-- Your SQL goes here
ALTER TABLE apps
ADD COLUMN encryption BOOLEAN DEFAULT FALSE;

UPDATE apps
SET encryption = FALSE;

ALTER TABLE apps
ALTER COLUMN encryption SET NOT NULL;
-- Safe Google customer authentication migration.
-- Run only after checking SHOW COLUMNS FROM users; no data is deleted.
ALTER TABLE users MODIFY password VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE;

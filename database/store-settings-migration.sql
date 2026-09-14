-- Persistent store settings. Safe to run repeatedly.
CREATE TABLE IF NOT EXISTS store_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_store_settings_admin FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO store_settings (setting_key, setting_value) VALUES
  ('shopName', 'Edison Shop'),
  ('tagline', 'Everything You Need, In One Shop'),
  ('currency', 'RWF'),
  ('deliveryFee', '5000'),
  ('freeDeliveryThreshold', '100000'),
  ('email', 'edisonigiraneza@gmail.com'),
  ('phone', '+250 795 031 113'),
  ('address', 'Rubavu District, Rwanda')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Scrub any legacy store email so the old address is never served again.
DELETE FROM store_settings WHERE setting_key = 'email' AND setting_value = 'hello@edson.shop';

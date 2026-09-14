-- ============================================================
-- Edison Shop - Cloudinary integration
-- Adds public_id columns used to track/manage Cloudinary assets
-- and the banners table used for homepage banner management.
-- Safe to run repeatedly: column adds are guarded, table uses
-- CREATE TABLE IF NOT EXISTS. No data is dropped.
-- ============================================================

SET NAMES utf8mb4;

-- Guarded add: users.profile_image_public_id
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'profile_image_public_id');
SET @sql = IF(@col = 0,
  'ALTER TABLE users ADD COLUMN profile_image_public_id VARCHAR(255) NULL AFTER profile_image',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Guarded add: categories.image_public_id
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'image_public_id');
SET @sql = IF(@col = 0,
  'ALTER TABLE categories ADD COLUMN image_public_id VARCHAR(255) NULL AFTER image',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Banners (homepage promotional images hosted on Cloudinary)
CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NULL,
  subtitle VARCHAR(300) NULL,
  image_url VARCHAR(500) NULL,
  image_public_id VARCHAR(255) NULL,
  link_url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_banners_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ============================================================
-- Edison Shop - Seed data
-- Database: edson_shop
-- Idempotent: uses INSERT IGNORE keyed on unique slugs/emails so
-- it never duplicates or overwrites existing data.
-- No DROP statements. Safe to run at any time.
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- ADMIN & DEMO CUSTOMER
-- bcrypt-hashed passwords (documented, development only):
--   Admin:    admin@edsonshop.com / supplied development admin password
--   Customer account is development-only and uses the bcrypt hash below.
-- ------------------------------------------------------------
UPDATE users
SET email = 'admin@edsonshop.com',
    password = '$2a$12$pXjcTm.HDqyV1FyNZ.yM8OwQaPU2ROBMeA99VcMQnLKGquPwcHws6',
    role = 'admin',
    status = 'active'
WHERE email = 'admin@edson.shop' AND role = 'admin';

INSERT IGNORE INTO users (full_name, email, phone, password, role, status)
VALUES
  ('Edison Shop Admin', 'admin@edsonshop.com', '+12500000001', '$2a$12$pXjcTm.HDqyV1FyNZ.yM8OwQaPU2ROBMeA99VcMQnLKGquPwcHws6', 'admin', 'active'),
  ('Demo Customer', 'customer@edson.shop', '+12500000002', NULL, 'customer', 'active');

-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------
INSERT IGNORE INTO categories (name, slug, description, image, status) VALUES
  ('Electronics', 'electronics', 'Phones, tablets, computers, audio and smart devices', NULL, 'active'),
  ('Stationery', 'stationery', 'Notebooks, writing tools and office essentials', NULL, 'active'),
  ('Graphics', 'graphics', 'Design and print services available in the Edison studio', NULL, 'active'),
  ('Others', 'others', 'Gifts, lifestyle and home items', NULL, 'active');

-- ------------------------------------------------------------
-- SUBCATEGORIES
-- ------------------------------------------------------------
INSERT IGNORE INTO subcategories (category_id, name, slug, description, status) VALUES
  ((SELECT id FROM categories WHERE slug = 'electronics'), 'Audio', 'audio', 'Headphones, speakers and sound', 'active'),
  ((SELECT id FROM categories WHERE slug = 'electronics'), 'Phones & Tablets', 'phones-tablets', 'Smartphones, tablets and mobile accessories', 'active'),
  ((SELECT id FROM categories WHERE slug = 'electronics'), 'Computers & Accessories', 'computers-accessories', 'Keyboards, mice, cables and upgrades', 'active'),
  ((SELECT id FROM categories WHERE slug = 'electronics'), 'Wearables', 'wearables', 'Smart watches and wearable tech', 'active'),
  ((SELECT id FROM categories WHERE slug = 'stationery'), 'Notebooks & Journals', 'notebooks-journals', 'Notebooks, journals and sketchbooks', 'active'),
  ((SELECT id FROM categories WHERE slug = 'stationery'), 'Writing Instruments', 'writing-instruments', 'Pens, pencils and markers', 'active'),
  ((SELECT id FROM categories WHERE slug = 'stationery'), 'Office Essentials', 'office-essentials', 'Paper, staplers and desk organization', 'active'),
  ((SELECT id FROM categories WHERE slug = 'stationery'), 'Art Supplies', 'art-supplies', 'Materials for creatives', 'active'),
  ((SELECT id FROM categories WHERE slug = 'graphics'), 'Print Production', 'print-production', 'Posters, flyers, business cards and more', 'active'),
  ((SELECT id FROM categories WHERE slug = 'graphics'), 'Apparel Printing', 'apparel-printing', 'Custom t-shirts and apparel', 'active'),
  ((SELECT id FROM categories WHERE slug = 'graphics'), 'Signage', 'signage', 'Banners and large format printing', 'active'),
  ((SELECT id FROM categories WHERE slug = 'others'), 'Gifts & Lifestyle', 'gifts-lifestyle', 'Gifts and lifestyle products', 'active'),
  ((SELECT id FROM categories WHERE slug = 'others'), 'Home & Living', 'home-living', 'Home, desk and living essentials', 'active');

-- ------------------------------------------------------------
-- PRODUCTS (35): 10 Electronics, 10 Stationery, 10 Graphics, 5 Others
-- ------------------------------------------------------------
INSERT IGNORE INTO products
  (category_id, subcategory_id, name, slug, sku, description, short_description,
   price, old_price, discount, stock, rating, reviews_count, main_image,
   is_featured, is_popular, is_active, created_by)
VALUES
  -- ELECTRONICS
  ((SELECT id FROM categories WHERE slug = 'electronics'), (SELECT id FROM subcategories WHERE slug = 'audio'), 'Wireless Headphones ANC', 'wireless-headphones-anc', 'ES-EL-001', 'High-quality over-ear wireless headphones with active noise cancellation and a 30-hour battery life.', 'Noise cancelling wireless headphones with deep bass', 89.99, 129.99, 31, 45, 4.60, 124, NULL, 1, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'electronics'), (SELECT id FROM subcategories WHERE slug = 'audio'), 'Bluetooth Speaker', 'bluetooth-speaker', 'ES-EL-002', 'Portable waterproof Bluetooth speaker with punchy 360-degree sound.', 'Portable 360 degree Bluetooth speaker', 39.99, NULL, 0, 60, 4.40, 86, NULL, 0, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'electronics'), (SELECT id FROM subcategories WHERE slug = 'wearables'), 'Smart Watch Pro', 'smart-watch-pro', 'ES-EL-003', 'Fitness smart watch with heart-rate tracking, GPS and a crisp AMOLED display.', 'Feature-packed smart watch for fitness tracking', 149.99, 199.99, 25, 30, 4.50, 211, NULL, 1, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'electronics'), (SELECT id FROM subcategories WHERE slug = 'phones-tablets'), 'USB-C Fast Charger 65W', 'usb-c-fast-charger-65w', 'ES-EL-004', 'Compact 65W GaN USB-C fast charger for phones, tablets and laptops.', '65W fast charging wall adapter', 24.99, NULL, 0, 120, 4.20, 58, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'electronics'), (SELECT id FROM subcategories WHERE slug = 'phones-tablets'), 'Power Bank 20000mAh', 'power-bank-20000mah', 'ES-EL-005', 'High-capacity 20000mAh power bank with dual fast-charge output.', 'High capacity 20000mAh power bank', 34.99, NULL, 0, 80, 4.30, 176, NULL, 0, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'electronics'), (SELECT id FROM subcategories WHERE slug = 'computers-accessories'), 'Webcam HD 1080p', 'webcam-hd-1080p', 'ES-EL-006', 'Full HD 1080p webcam with auto light correction for calls and streaming.', '1080p webcam for calls and streaming', 45.00, NULL, 0, 25, 4.00, 41, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'electronics'), (SELECT id FROM subcategories WHERE slug = 'computers-accessories'), 'Mechanical Keyboard RGB', 'mechanical-keyboard-rgb', 'ES-EL-007', 'Tactile mechanical keyboard with customizable RGB lighting and hot-swap switches.', 'RGB mechanical keyboard, hot-swap switches', 79.99, 99.99, 20, 40, 4.70, 203, NULL, 1, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'electronics'), (SELECT id FROM subcategories WHERE slug = 'computers-accessories'), 'Wireless Mouse', 'wireless-mouse', 'ES-EL-008', 'Silent wireless mouse with long battery life and precise tracking.', 'Silent wireless mouse', 24.99, NULL, 0, 90, 4.10, 67, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'electronics'), (SELECT id FROM subcategories WHERE slug = 'computers-accessories'), 'Laptop Stand Aluminum', 'laptop-stand-aluminum', 'ES-EL-009', 'Ergonomic aluminum laptop stand with adjustable height and improved airflow.', 'Ergonomic aluminum laptop stand', 29.99, NULL, 0, 55, 4.20, 93, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'electronics'), (SELECT id FROM subcategories WHERE slug = 'computers-accessories'), 'HDMI Cable 2m', 'hdmi-cable-2m', 'ES-EL-010', 'Braided HDMI cable supporting 4K resolution and HDR.', 'Braided 4K HDMI cable', 12.99, NULL, 0, 200, 4.00, 35, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),

  -- STATIONERY
  ((SELECT id FROM categories WHERE slug = 'stationery'), (SELECT id FROM subcategories WHERE slug = 'notebooks-journals'), 'Emblem Notebook A5', 'emblem-notebook-a5', 'ES-ST-001', 'Durable A5 notebook with 120 sheets of smooth bleed-resistant paper.', 'Hardcover A5 dotted notebook', 8.99, 12.99, 31, 150, 4.80, 312, NULL, 1, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'stationery'), (SELECT id FROM subcategories WHERE slug = 'notebooks-journals'), 'Premium Sketchbook', 'premium-sketchbook', 'ES-ST-002', 'Heavy-weight sketchbook, perfect for pencils, inks and light washes.', 'Premium sketchbook for artists', 14.99, NULL, 0, 70, 4.60, 88, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'stationery'), (SELECT id FROM subcategories WHERE slug = 'writing-instruments'), 'Gel Pen Set (10)', 'gel-pen-set-10', 'ES-ST-003', 'Set of ten smooth-writing gel pens with a comfortable grip.', 'Pack of 10 gel pens', 9.99, NULL, 0, 110, 4.30, 71, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'stationery'), (SELECT id FROM subcategories WHERE slug = 'writing-instruments'), 'Fountain Pen Classic', 'fountain-pen-classic', 'ES-ST-004', 'Classic fountain pen with an elegant metal body and medium nib.', 'Elegant classic fountain pen', 24.99, 34.99, 29, 35, 4.70, 104, NULL, 1, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'stationery'), (SELECT id FROM subcategories WHERE slug = 'office-essentials'), 'Stapler Heavy Duty', 'stapler-heavy-duty', 'ES-ST-005', 'Heavy-duty stapler able to fasten up to 30 sheets at once.', 'Heavy-duty 30 sheet stapler', 11.99, NULL, 0, 60, 4.10, 39, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'stationery'), (SELECT id FROM subcategories WHERE slug = 'office-essentials'), 'A4 Printer Paper (500)', 'a4-printer-paper-500', 'ES-ST-006', 'Ream of 500 bright white A4 sheets, ideal for everyday printing.', '500 sheets of A4 printer paper', 7.99, NULL, 0, 400, 4.20, 52, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'stationery'), (SELECT id FROM subcategories WHERE slug = 'office-essentials'), 'Desktop Organizer', 'desktop-organizer', 'ES-ST-007', 'Multi-compartment desk organizer for papers, pens and gadgets.', 'Multi-compartment desktop organizer', 18.99, NULL, 0, 45, 4.50, 76, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'stationery'), (SELECT id FROM subcategories WHERE slug = 'writing-instruments'), 'Highlighters Set (6)', 'highlighters-set-6', 'ES-ST-008', 'Set of six vibrant chisel-tip highlighters.', 'Set of six highlighters', 6.49, NULL, 0, 130, 4.00, 33, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'stationery'), (SELECT id FROM subcategories WHERE slug = 'office-essentials'), 'Sticky Notes Pack', 'sticky-notes-pack', 'ES-ST-009', 'Eight pads of colorful sticky notes for quick reminders.', '8 pads of colorful sticky notes', 5.99, NULL, 0, 180, 4.40, 60, NULL, 0, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'stationery'), (SELECT id FROM subcategories WHERE slug = 'art-supplies'), 'Retractable Marker Set (20)', 'retractable-marker-set-20', 'ES-ST-010', 'Twenty dual-tip retractable markers for drawing and coloring.', '20 color retractable markers', 12.49, NULL, 0, 85, 4.30, 46, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),

  -- GRAPHICS PRODUCTS
  ((SELECT id FROM categories WHERE slug = 'graphics'), (SELECT id FROM subcategories WHERE slug = 'print-production'), 'A3 Poster Print', 'poster-print-a3', 'ES-GR-001', 'Vivid A3 poster printing on 200gsm matte or glossy paper.', 'A3 poster printing service', 14.99, NULL, 0, 999, 4.90, 118, NULL, 0, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'graphics'), (SELECT id FROM subcategories WHERE slug = 'print-production'), 'Business Cards (100)', 'business-cards-100', 'ES-GR-002', 'One hundred double-sided full-color business cards on premium stock.', '100 double-sided business cards', 12.49, 15.99, 22, 999, 4.80, 224, NULL, 1, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'graphics'), (SELECT id FROM subcategories WHERE slug = 'signage'), 'Roll-Up Banner Stand', 'roll-up-banner-stand', 'ES-GR-003', 'Professional roll-up banner with stand, printed in full color.', 'Roll-up banner stand printing', 89.99, NULL, 0, 999, 4.70, 66, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'graphics'), (SELECT id FROM subcategories WHERE slug = 'print-production'), 'Vinyl Sticker Pack (50)', 'vinyl-sticker-pack-50', 'ES-GR-004', 'Fifty die-cut vinyl stickers with a waterproof matte or gloss finish.', '50 custom die-cut vinyl stickers', 19.99, NULL, 0, 999, 4.60, 91, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'graphics'), (SELECT id FROM subcategories WHERE slug = 'apparel-printing'), 'T-Shirt Print', 'tshirt-print', 'ES-GR-005', 'Custom t-shirt printing with long-lasting direct-to-garment quality.', 'Custom t-shirt printing service', 15.99, NULL, 0, 999, 4.80, 143, NULL, 0, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'graphics'), (SELECT id FROM subcategories WHERE slug = 'print-production'), 'Flyer Print (500)', 'flyer-print-500', 'ES-GR-006', 'Five hundred full-color A5 flyers printed on 135gsm paper.', '500 full-color A5 flyers', 29.99, NULL, 0, 999, 4.50, 74, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'graphics'), (SELECT id FROM subcategories WHERE slug = 'print-production'), 'Invitation Cards (50)', 'invitation-cards-50', 'ES-GR-007', 'Fifty premium invitation cards with elegant finishing options.', '50 premium invitation cards', 24.99, NULL, 0, 999, 4.60, 39, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'graphics'), (SELECT id FROM subcategories WHERE slug = 'print-production'), 'Photo Print 6x4 (100)', 'photo-print-6x4-100', 'ES-GR-008', 'One hundred glossy 6x4 photo prints, ready to frame.', '100 glossy 6x4 photo prints', 9.99, NULL, 0, 999, 4.70, 187, NULL, 0, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'graphics'), (SELECT id FROM subcategories WHERE slug = 'print-production'), 'Certificate Print (20)', 'certificate-print-20', 'ES-GR-009', 'Twenty high-quality certificate prints on textured 250gsm stock.', '20 premium certificate prints', 18.99, NULL, 0, 999, 4.40, 25, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'graphics'), (SELECT id FROM subcategories WHERE slug = 'print-production'), 'Brochure Tri-Fold (200)', 'brochure-trifold-200', 'ES-GR-010', 'Two hundred tri-fold brochures printed in full color and folded.', '200 tri-fold full-color brochures', 49.99, NULL, 0, 999, 4.60, 58, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),

  -- OTHERS
  ((SELECT id FROM categories WHERE slug = 'others'), (SELECT id FROM subcategories WHERE slug = 'gifts-lifestyle'), 'Premium Gift Box', 'premium-gift-box', 'ES-OT-001', 'Elegant reusable premium gift box, perfect for gifting.', 'Elegant premium gift box', 22.99, 27.99, 18, 60, 4.80, 142, NULL, 1, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'others'), (SELECT id FROM subcategories WHERE slug = 'home-living'), 'LED Desk Lamp', 'led-desk-lamp', 'ES-OT-002', 'Adjustable LED desk lamp with warm and cool light modes.', 'Adjustable LED desk lamp', 32.99, NULL, 0, 40, 4.50, 96, NULL, 0, 1, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'others'), (SELECT id FROM subcategories WHERE slug = 'home-living'), 'Ceramic Mug Set (2)', 'ceramic-mug-set-2', 'ES-OT-003', 'Two minimalist matte ceramic mugs, 350ml each.', 'Set of two ceramic mugs', 16.99, NULL, 0, 75, 4.30, 51, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'others'), (SELECT id FROM subcategories WHERE slug = 'gifts-lifestyle'), 'Canvas Tote Bag', 'canvas-tote-bag', 'ES-OT-004', 'Sturdy cotton canvas tote bag for everyday carry.', 'Durable canvas tote bag', 12.99, NULL, 0, 95, 4.60, 83, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop')),
  ((SELECT id FROM categories WHERE slug = 'others'), (SELECT id FROM subcategories WHERE slug = 'home-living'), 'Storage Box Set (3)', 'storage-box-set-3', 'ES-OT-005', 'Three stackable fabric storage boxes in neutral tones.', 'Set of 3 stackable storage boxes', 25.99, NULL, 0, 50, 4.20, 37, NULL, 0, 0, 1, (SELECT id FROM users WHERE email = 'admin@edson.shop'));

-- ------------------------------------------------------------
-- GRAPHICS SERVICES (12)
-- ------------------------------------------------------------
INSERT IGNORE INTO graphics_services (name, slug, description, category, starting_price, image, is_featured, is_active) VALUES
  ('Banner Design', 'banner-design', 'Custom banner artwork designed by our studio to your brand and message.', 'Design', 25.00, NULL, 1, 1),
  ('Printed Banner', 'printed-banner', 'Full-color printed banners in multiple sizes, ready to hang.', 'Printing', 35.00, NULL, 1, 1),
  ('T-Shirt Design', 'tshirt-design', 'Original t-shirt artwork, illustrations and typography.', 'Design', 20.00, NULL, 1, 1),
  ('Printed T-Shirt', 'printed-tshirt', 'Custom-printed t-shirts using DTG and screen printing.', 'Printing', 15.00, NULL, 0, 1),
  ('Poster Design', 'poster-design', 'Eye-catching poster designs for events, sales and campaigns.', 'Design', 18.00, NULL, 1, 1),
  ('Business Card', 'business-card', 'Professional business card design and print packages.', 'Design & Print', 12.00, NULL, 0, 1),
  ('Flyer', 'flyer', 'Modern flyer design and printing for any event.', 'Design & Print', 15.00, NULL, 0, 1),
  ('Logo Design', 'logo-design', 'Unique logo design with multiple concepts and revisions.', 'Design', 60.00, NULL, 1, 1),
  ('Invitation Design', 'invitation-design', 'Elegant digital and print invitation designs.', 'Design', 22.00, NULL, 0, 1),
  ('Photo Printing', 'photo-printing', 'Quick and vibrant photo prints in all standard sizes.', 'Printing', 5.00, NULL, 0, 1),
  ('Social Media Design', 'social-media-design', 'Ready-to-post graphics for your social media pages.', 'Design', 30.00, NULL, 0, 1),
  ('Custom Design', 'custom-design', 'Tell us your idea and our studio will bring it to life.', 'Design', 50.00, NULL, 1, 1);

UPDATE products p
JOIN users u ON u.email = 'admin@edsonshop.com' AND u.role = 'admin'
SET p.created_by = u.id
WHERE p.sku LIKE 'ES-%' AND p.created_by IS NULL;
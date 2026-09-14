-- Edison Shop category data migration
-- Safe to run repeatedly. It inserts missing catalogue categories only.
-- Existing users, products, orders, and other records are preserved.

INSERT IGNORE INTO categories (name, slug, description, image, status) VALUES
  ('Electronics', 'electronics', 'Phones, tablets, computers, audio and smart devices', NULL, 'active'),
  ('Stationery', 'stationery', 'Notebooks, writing tools and office essentials', NULL, 'active'),
  ('Graphics', 'graphics', 'Design and print services available in the Edison studio', NULL, 'active'),
  ('Others', 'others', 'Gifts, lifestyle and home items', NULL, 'active');

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

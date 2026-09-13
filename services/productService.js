const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const { storeImage, deleteImage } = require('./imageService');

const LIST_FIELDS = `
  p.id, p.name, p.slug, p.sku, p.short_description, p.description,
  p.price, p.old_price, p.discount, p.stock, p.rating, p.reviews_count,
  p.main_image, p.is_featured, p.is_popular, p.is_active,
  p.category_id, c.name AS category_name, c.slug AS category_slug,
  p.subcategory_id, sc.name AS subcategory_name, sc.slug AS subcategory_slug,
  p.created_by, p.created_at, p.updated_at`;

const INDEXES_SQL = `
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN subcategories sc ON p.subcategory_id = sc.id`;

function computeDiscount(price, oldPrice) {
  const p = Number(price) || 0;
  const op = Number(oldPrice) || 0;
  return op > p && op > 0 ? Math.round(((op - p) / op) * 100) : 0;
}

function buildWhere(params) {
  const where = ['p.is_active = 1'];
  const values = [];

  if (params.category && params.category !== 'all') {
    where.push('c.slug = ?');
    values.push(params.category);
  }
  if (params.subcategory && params.subcategory !== 'all') {
    where.push('sc.slug = ?');
    values.push(params.subcategory);
  }
  if (params.search) {
    where.push(
      '(p.name LIKE ? OR p.short_description LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)'
    );
    const q = `%${String(params.search).trim()}%`;
    values.push(q, q, q, q);
  }
  if (params.minPrice !== undefined && params.minPrice !== null && params.minPrice !== '') {
    where.push('p.price >= ?');
    values.push(Number(params.minPrice));
  }
  if (params.maxPrice !== undefined && params.maxPrice !== null && params.maxPrice !== '') {
    where.push('p.price <= ?');
    values.push(Number(params.maxPrice));
  }
  if (params.featured === '1' || params.featured === true || params.featured === 1) {
    where.push('p.is_featured = 1');
  }
  if (params.popular === '1' || params.popular === true || params.popular === 1) {
    where.push('p.is_popular = 1');
  }

  return { where, values };
}

function sortSql(sort) {
  switch (sort) {
    case 'price_low':
      return 'p.price ASC, p.id ASC';
    case 'price_high':
      return 'p.price DESC, p.id DESC';
    case 'rating':
      return 'p.rating DESC, p.reviews_count DESC, p.id DESC';
    case 'popular':
      return 'p.is_popular DESC, p.reviews_count DESC, p.rating DESC, p.id DESC';
    case 'newest':
    default:
      return 'p.id DESC';
  }
}

async function getProducts(params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 12));
  const { where, values } = buildWhere(params);
  const orderClause = sortSql(params.sort || 'newest');

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN subcategories sc ON p.subcategory_id = sc.id ${whereSql}`,
    values
  );
  const total = Number(countRows[0].total);
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT ${LIST_FIELDS} ${INDEXES_SQL} ${whereSql}
     ORDER BY ${orderClause} LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return {
    products: rows,
    pagination: { page, limit, total, totalPages },
  };
}

async function getProductDetail(id) {
  const [rows] = await pool.query(
    `SELECT ${LIST_FIELDS} ${INDEXES_SQL} WHERE p.id = ? AND p.is_active = 1`,
    [id]
  );
  if (rows.length === 0) return null;

  const [images] = await pool.query(
    `SELECT id, image_url, public_id, is_primary, sort_order
     FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC`,
    [id]
  );

  return { ...rows[0], images };
}

async function getProductBySlug(slug) {
  const [rows] = await pool.query(
    `SELECT ${LIST_FIELDS} ${INDEXES_SQL} WHERE p.slug = ? AND p.is_active = 1`,
    [slug]
  );
  if (rows.length === 0) return null;

  const [images] = await pool.query(
    `SELECT id, image_url, public_id, is_primary, sort_order
     FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC`,
    [rows[0].id]
  );

  return { ...rows[0], images };
}

async function getProductsByCategorySlug(slug, limit = 50) {
  return getProducts({ category: slug, limit });
}

async function getFeatured(limit = 12) {
  return getProducts({ featured: '1', limit });
}

async function getPopular(limit = 12) {
  return getProducts({ popular: '1', limit });
}

async function searchProducts(query, limit = 20) {
  return getProducts({ search: query, limit });
}

async function createProduct(data, createdBy) {
  const name = String(data.name || '').trim();
  const slug = String(data.slug || name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const sku = String(data.sku || `ES-${Date.now()}`).trim();
  const description = data.description;
  const short_description = data.short_description || data.shortDescription;
  const price = Number(data.price) || 0;
  const old_price = data.old_price ?? data.oldPrice;
  const stock = data.stock;
  const main_image = data.main_image ?? data.image;
  const is_featured = data.is_featured ?? data.featured;
  const is_popular = data.is_popular ?? data.popular;
  const category_id = await resolveCategoryId(data.category_id ?? data.category);
  const subcategory_id = await resolveSubcategoryId(data.subcategory_id ?? data.subcategory, category_id);

  if (!name) {
    throw new AppError('Product name is required', 400);
  }

  await ensureCategoryAndSubcategory(category_id, subcategory_id);

  const discount = computeDiscount(price, old_price);

  const [result] = await pool.query(
    `INSERT INTO products
      (category_id, subcategory_id, name, slug, sku, description, short_description,
       price, old_price, discount, stock, main_image, is_featured, is_popular, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      category_id || null,
      subcategory_id || null,
      name,
      slug,
      sku,
      description || null,
      short_description || null,
      price,
      old_price || 0,
      discount,
      Number(stock) || 0,
      main_image || null,
      is_featured ? 1 : 0,
      is_popular ? 1 : 0,
      createdBy || null,
    ]
  );

  if (main_image) {
    await pool.query(
      `INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
       VALUES (?, ?, 1, 0)`,
      [result.insertId, main_image]
    );
  }

  return getProductDetail(result.insertId);
}

async function ensureCategoryAndSubcategory(categoryId, subcategoryId) {
  if (!categoryId) throw new AppError('Category is required', 400);
  if (categoryId) {
    const [rows] = await pool.query('SELECT id FROM categories WHERE id = ?', [categoryId]);
    if (rows.length === 0) throw new AppError('Category not found', 404);
  }
  if (subcategoryId) {
    const [rows] = await pool.query(
      'SELECT id FROM subcategories WHERE id = ? AND category_id = ?',
      [subcategoryId, categoryId]
    );
    if (rows.length === 0) throw new AppError('Subcategory not found', 404);
  }
}

async function resolveCategoryId(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new AppError('Category is required', 400);
  }
  const normalized = String(value).trim();
  const [rows] = await pool.query(
    'SELECT id FROM categories WHERE slug = ? OR LOWER(name) = LOWER(?) OR id = ? LIMIT 1',
    [normalized.toLowerCase(), normalized, /^\d+$/.test(normalized) ? Number(normalized) : null]
  );
  if (rows.length === 0) throw new AppError('Category not found', 404);
  return rows[0].id;
}

async function resolveSubcategoryId(value, categoryId) {
  if (!value) return null;
  const name = String(value).trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const [rows] = await pool.query(
    'SELECT id FROM subcategories WHERE (slug = ? OR LOWER(name) = LOWER(?) OR id = ?) AND category_id = ? LIMIT 1',
    [slug, name, /^\d+$/.test(name) ? Number(name) : null, categoryId]
  );
  if (rows.length > 0) return rows[0].id;
  throw new AppError('Subcategory not found', 404);
}

async function updateProduct(id, data) {
  const [existing] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
  if (existing.length === 0) throw new AppError('Product not found', 404);

  const cur = existing[0];
  const price = data.price !== undefined ? Number(data.price) : Number(cur.price);
  const oldPrice =
    data.old_price !== undefined ? Number(data.old_price) : Number(cur.old_price || 0);
  const discount =
    data.discount !== undefined ? Number(data.discount) : computeDiscount(price, oldPrice);

  const categoryValue = data.category_id !== undefined
    ? data.category_id
    : data.category !== undefined
      ? data.category
      : cur.category_id;
  const category_id = await resolveCategoryId(categoryValue);
  const subcategoryValue = data.subcategory_id !== undefined
    ? data.subcategory_id
    : data.subcategory !== undefined
      ? data.subcategory
      : cur.subcategory_id;
  const subcategory_id = await resolveSubcategoryId(subcategoryValue, category_id);

  const allowed = {
    category_id,
    subcategory_id,
    name: data.name !== undefined ? data.name : cur.name,
    slug: data.slug !== undefined ? data.slug : cur.slug,
    sku: data.sku !== undefined ? data.sku : cur.sku,
    description: data.description !== undefined ? data.description : cur.description,
    short_description:
      data.short_description !== undefined
        ? data.short_description
        : cur.short_description,
    price,
    old_price: oldPrice,
    discount,
    stock: data.stock !== undefined ? Number(data.stock) : Number(cur.stock),
    main_image: data.main_image !== undefined ? data.main_image : cur.main_image,
    is_featured:
      data.is_featured !== undefined ? Number(!!data.is_featured) : Number(cur.is_featured),
    is_popular:
      data.is_popular !== undefined ? Number(!!data.is_popular) : Number(cur.is_popular),
    is_active:
      data.is_active !== undefined ? Number(!!data.is_active) : Number(cur.is_active),
  };

  await ensureCategoryAndSubcategory(allowed.category_id, allowed.subcategory_id);

  await pool.query(
    `UPDATE products SET
       category_id = ?, subcategory_id = ?, name = ?, slug = ?, sku = ?,
       description = ?, short_description = ?, price = ?, old_price = ?, discount = ?,
       stock = ?, main_image = ?, is_featured = ?, is_popular = ?, is_active = ?
     WHERE id = ?`,
    [
      allowed.category_id,
      allowed.subcategory_id,
      allowed.name,
      allowed.slug,
      allowed.sku,
      allowed.description,
      allowed.short_description,
      allowed.price,
      allowed.old_price,
      allowed.discount,
      allowed.stock,
      allowed.main_image,
      allowed.is_featured,
      allowed.is_popular,
      allowed.is_active,
      id,
    ]
  );

  return getProductDetail(id);
}

async function deleteProduct(id) {
  const [existing] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
  if (existing.length === 0) throw new AppError('Product not found', 404);

  // If historical orders reference this product, keep the row but hide it.
  const [refs] = await pool.query(
    'SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?',
    [id]
  );

  if (Number(refs[0].c) > 0) {
    await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
    return { id, softDeleted: true };
  }

  await pool.query('DELETE FROM products WHERE id = ?', [id]);
  return { id, softDeleted: false };
}

async function updateProductStatus(id, isActive) {
  const [result] = await pool.query('UPDATE products SET is_active = ? WHERE id = ?', [
    isActive ? 1 : 0,
    id,
  ]);
  if (result.affectedRows === 0) throw new AppError('Product not found', 404);
  return getProductDetail(id);
}

async function updateProductStock(id, stock) {
  const qty = Number(stock);
  if (!Number.isInteger(qty) || qty < 0) {
    throw new AppError('Stock must be a non-negative integer', 400);
  }
  const [result] = await pool.query('UPDATE products SET stock = ? WHERE id = ?', [qty, id]);
  if (result.affectedRows === 0) throw new AppError('Product not found', 404);
  return getProductDetail(id);
}

async function addProductImage(productId, file) {
  const [existing] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
  if (existing.length === 0) throw new AppError('Product not found', 404);

  const uploaded = await storeImage(file, { folder: 'products' });

  const [orderRows] = await pool.query(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM product_images WHERE product_id = ?',
    [productId]
  );
  const sortOrder = orderRows[0].next_sort;

  const [imageRows] = await pool.query(
    'SELECT COUNT(*) AS c FROM product_images WHERE product_id = ?',
    [productId]
  );

  await pool.query(
    `INSERT INTO product_images (product_id, image_url, public_id, is_primary, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [productId, uploaded.url, uploaded.publicId, imageRows[0].c === 0 ? 1 : 0, sortOrder]
  );

  if (imageRows[0].c === 0) {
    await pool.query('UPDATE products SET main_image = ? WHERE id = ?', [
      uploaded.url,
      productId,
    ]);
  }

  return getProductDetail(productId);
}

async function deleteProductImage(imageId) {
  const [rows] = await pool.query(
    'SELECT id, product_id, image_url, public_id, is_primary FROM product_images WHERE id = ?',
    [imageId]
  );
  if (rows.length === 0) throw new AppError('Image not found', 404);

  const img = rows[0];

  await pool.query('DELETE FROM product_images WHERE id = ?', [imageId]);

  if (Number(img.is_primary) === 1) {
    const [next] = await pool.query(
      `SELECT id, image_url FROM product_images
       WHERE product_id = ? AND id != ?
       ORDER BY sort_order ASC LIMIT 1`,
      [img.product_id, imageId]
    );

    if (next.length > 0) {
      await pool.query('UPDATE product_images SET is_primary = 1 WHERE id = ?', [next[0].id]);
      await pool.query('UPDATE products SET main_image = ? WHERE id = ?', [
        next[0].image_url,
        img.product_id,
      ]);
    } else {
      await pool.query('UPDATE products SET main_image = NULL WHERE id = ?', [img.product_id]);
    }
  }

  await deleteImage(img.public_id, img.image_url);

  return getProductDetail(img.product_id);
}

async function setProductPrimaryImage(imageId) {
  const [rows] = await pool.query('SELECT id, product_id, image_url FROM product_images WHERE id = ?', [imageId]);
  if (rows.length === 0) throw new AppError('Image not found', 404);

  const { product_id: productId, image_url: imageUrl } = rows[0];

  await pool.query('UPDATE product_images SET is_primary = 0 WHERE product_id = ?', [productId]);
  await pool.query('UPDATE product_images SET is_primary = 1 WHERE id = ?', [imageId]);
  await pool.query('UPDATE products SET main_image = ? WHERE id = ?', [imageUrl, productId]);

  return getProductDetail(productId);
}

module.exports = {
  getProducts,
  getProductDetail,
  getProductBySlug,
  getProductsByCategorySlug,
  getFeatured,
  getPopular,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStatus,
  updateProductStock,
  addProductImage,
  deleteProductImage,
  setProductPrimaryImage,
  computeDiscount,
};
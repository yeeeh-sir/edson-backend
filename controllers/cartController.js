const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');

const CART_ITEM_FIELDS = `
  ci.id, ci.product_id, ci.quantity,
  p.name AS product_name, p.slug AS product_slug, p.sku,
  p.price, p.old_price, p.discount, p.stock,
  p.main_image, p.rating, p.reviews_count,
  c.slug AS category_slug, c.name AS category_name`;

async function getCart(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT ${CART_ITEM_FIELDS}
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ci.user_id = ?
       ORDER BY ci.id ASC`,
      [req.user.id]
    );

    const items = rows.filter((r) => r.product_id !== null);
    const subtotal = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
    const delivery = items.length === 0 || subtotal >= 100 ? 0 : 5;
    const total = subtotal + delivery;

    return res.json({
      success: true,
      message: 'Cart retrieved',
      data: { items, count: items.length, subtotal, delivery_fee: delivery, total },
    });
  } catch (err) {
    return next(err);
  }
}

async function addToCart(req, res, next) {
  try {
    const productId = Number(req.body.product_id);
    const quantity = Math.max(1, Math.floor(Number(req.body.quantity) || 1));

    const [products] = await pool.query(
      'SELECT id, stock, is_active FROM products WHERE id = ?',
      [productId]
    );

    if (products.length === 0) throw new AppError('Product not found', 404);
    const product = products[0];
    if (!product.is_active) throw new AppError('Product is not available', 400);
    if (quantity > Number(product.stock)) {
      throw new AppError(`Only ${product.stock} left in stock`, 400);
    }

    const [existing] = await pool.query(
      'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
      [req.user.id, productId]
    );

    let newQuantity = quantity;
    if (existing.length > 0) {
      newQuantity = Number(existing[0].quantity) + quantity;
      if (newQuantity > Number(product.stock)) {
        throw new AppError(`Only ${product.stock} left in stock`, 400);
      }
    }

    await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
      [req.user.id, productId, newQuantity]
    );

    const [rows] = await pool.query(
      `SELECT ${CART_ITEM_FIELDS}
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ci.user_id = ? ORDER BY ci.id ASC`,
      [req.user.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Added to cart',
      data: { items: rows },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateCartItem(req, res, next) {
  try {
    const quantity = Math.max(1, Math.floor(Number(req.body.quantity) || 1));

    const [rows] = await pool.query(
      'SELECT id, product_id FROM cart_items WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) throw new AppError('Cart item not found', 404);

    const [products] = await pool.query(
      'SELECT stock, is_active FROM products WHERE id = ?',
      [rows[0].product_id]
    );
    if (products.length === 0) throw new AppError('Product not found', 404);
    if (!products[0].is_active) throw new AppError('Product is not available', 400);
    if (quantity > Number(products[0].stock)) {
      throw new AppError(`Only ${products[0].stock} left in stock`, 400);
    }

    await pool.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
      [quantity, req.params.id, req.user.id]
    );

    const [cartRows] = await pool.query(
      `SELECT ${CART_ITEM_FIELDS}
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ci.user_id = ? ORDER BY ci.id ASC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      message: 'Cart updated',
      data: { items: cartRows },
    });
  } catch (err) {
    return next(err);
  }
}

async function removeCartItem(req, res, next) {
  try {
    const [result] = await pool.query(
      'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) throw new AppError('Cart item not found', 404);

    return res.json({ success: true, message: 'Item removed from cart' });
  } catch (err) {
    return next(err);
  }
}

async function clearCart(req, res, next) {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
    return res.json({ success: true, message: 'Cart cleared' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart };
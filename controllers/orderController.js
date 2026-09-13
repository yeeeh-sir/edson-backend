const orderService = require('../services/orderService');
const { logAdminActivity } = require('./adminController');

async function createOrder(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Payment confirmation is required before an order can be created.',
      });
    }
    const order = await orderService.createOrder(req.user, req.body);

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { order },
    });
  } catch (err) {
    return next(err);
  }
}

async function getOrders(req, res, next) {
  try {
    const isAdmin = req.user.role === 'admin';
    const data = await orderService.getOrders(req.user, isAdmin, {
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.json({
      success: true,
      message: 'Orders retrieved',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function getOrderById(req, res, next) {
  try {
    const isAdmin = req.user.role === 'admin';
    const order = await orderService.getOrderById(req.params.id, req.user, isAdmin);

    return res.json({
      success: true,
      message: 'Order retrieved',
      data: { order },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, req.body.status);

    await logAdminActivity(req, 'ORDER_STATUS', 'order', order.id, `Order ${order.order_number} → ${order.status}`);

    return res.json({
      success: true,
      message: 'Order status updated',
      data: { order },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateOrderPaymentStatus(req, res, next) {
  try {
    const order = await orderService.updateOrderPaymentStatus(
      req.params.id,
      req.body.payment_status
    );

    await logAdminActivity(req, 'PAYMENT_STATUS', 'order', order.id, `Order ${order.order_number} payment → ${order.payment_status}`);

    return res.json({
      success: true,
      message: 'Payment status updated',
      data: { order },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderPaymentStatus,
};
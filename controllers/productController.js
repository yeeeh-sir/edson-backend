const productService = require('../services/productService');
const { AppError } = require('../middleware/errorMiddleware');
const { logAdminActivity } = require('./adminController');

async function getAllProducts(req, res, next) {
  try {
    const data = await productService.getProducts({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      category: req.query.category,
      subcategory: req.query.subcategory,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      sort: req.query.sort,
      featured: req.query.featured,
      popular: req.query.popular,
    });
    return res.json({
      success: true,
      message: 'Products retrieved',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const product = await productService.getProductDetail(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    return res.json({
      success: true,
      message: 'Product retrieved',
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function getProductBySlug(req, res, next) {
  try {
    const product = await productService.getProductBySlug(req.params.slug);
    if (!product) throw new AppError('Product not found', 404);
    return res.json({
      success: true,
      message: 'Product retrieved',
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function getProductsByCategory(req, res, next) {
  try {
    const data = await productService.getProductsByCategorySlug(req.params.slug);
    return res.json({
      success: true,
      message: 'Products retrieved',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function getFeaturedProducts(req, res, next) {
  try {
    const data = await productService.getFeatured(req.query.limit);
    return res.json({
      success: true,
      message: 'Featured products retrieved',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function getPopularProducts(req, res, next) {
  try {
    const data = await productService.getPopular(req.query.limit);
    return res.json({
      success: true,
      message: 'Popular products retrieved',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function searchProducts(req, res, next) {
  try {
    const data = await productService.searchProducts(req.query.q || '');
    return res.json({
      success: true,
      message: 'Search results',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const product = await productService.createProduct(req.body, req.user.id);

    await logAdminActivity(req, 'CREATE', 'product', product.id, `Created product "${product.name}"`);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);

    await logAdminActivity(req, 'UPDATE', 'product', product.id, `Updated product "${product.name}"`);

    return res.json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const result = await productService.deleteProduct(req.params.id);

    await logAdminActivity(
      req,
      'DELETE',
      'product',
      req.params.id,
      result.softDeleted
        ? `Product ${req.params.id} hidden (referenced by orders)`
        : `Product ${req.params.id} deleted`
    );

    return res.json({
      success: true,
      message: result.softDeleted
        ? 'Product hidden because it is referenced by orders'
        : 'Product deleted successfully',
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

async function patchProductStatus(req, res, next) {
  try {
    const product = await productService.updateProductStatus(
      req.params.id,
      req.body.is_active
    );

    await logAdminActivity(
      req,
      req.body.is_active ? 'ACTIVATE' : 'DEACTIVATE',
      'product',
      product.id,
      `${req.body.is_active ? 'Activated' : 'Deactivated'} product "${product.name}"`
    );

    return res.json({
      success: true,
      message: 'Product status updated',
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function patchProductStock(req, res, next) {
  try {
    const product = await productService.updateProductStock(req.params.id, req.body.stock);

    await logAdminActivity(req, 'STOCK', 'product', product.id, `Set stock to ${product.stock} for "${product.name}"`);

    return res.json({
      success: true,
      message: 'Product stock updated',
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function addProductImages(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    }

    let product = null;
    for (const file of req.files) {
      product = await productService.addProductImage(req.params.id, file);
    }

    await logAdminActivity(req, 'IMAGES', 'product', req.params.id, 'Added product images');

    return res.status(201).json({
      success: true,
      message: 'Images added successfully',
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function removeProductImage(req, res, next) {
  try {
    const product = await productService.deleteProductImage(req.params.imageId);

    await logAdminActivity(req, 'IMAGE_REMOVE', 'product', product ? product.id : req.params.productId, 'Removed a product image');

    return res.json({
      success: true,
      message: 'Image deleted successfully',
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

async function setPrimaryProductImage(req, res, next) {
  try {
    const product = await productService.setProductPrimaryImage(req.params.imageId);

    await logAdminActivity(req, 'IMAGE_PRIMARY', 'product', product.id, 'Changed primary product image');

    return res.json({
      success: true,
      message: 'Primary image updated',
      data: { product },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  getProductBySlug,
  getProductsByCategory,
  getFeaturedProducts,
  getPopularProducts,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  patchProductStatus,
  patchProductStock,
  addProductImages,
  removeProductImage,
  setPrimaryProductImage,
};
const fs = require('fs');
const path = require('path');
const { cloudinary, isConfigured } = require('../config/cloudinary');
const { uploadsDir } = require('../middleware/uploadMiddleware');
const { AppError } = require('../middleware/errorMiddleware');

const API_URL = process.env.API_URL || 'http://localhost:5000';

const ROOT_FOLDER = 'edson-shop';

// Per-type Cloudinary folders and web optimization presets.
const FOLDERS = {
  products: 'edson-shop/products',
  profiles: 'edson-shop/profiles',
  categories: 'edson-shop/categories',
  banners: 'edson-shop/banners',
  'payment-screenshots': 'edson-shop/payment-screenshots',
  graphics: 'edson-shop/graphics',
};

// Presets cap dimensions and let Cloudinary auto-optimize format/quality.
const TRANSFORMATIONS = {
  products: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  profiles: [{ width: 600, height: 600, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  categories: [{ width: 900, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  banners: [{ width: 2000, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  'payment-screenshots': [{ quality: 'auto', fetch_format: 'auto' }],
  graphics: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
};

function isRemoteCloudinaryUrl(url) {
  return typeof url === 'string' && /^https:\/\/res\.cloudinary\.com\//i.test(url);
}

function localFileUrl(filename) {
  return `${API_URL}/uploads/${path.basename(filename)}`;
}

/**
 * Resolve a folder for a given image type.
 * Falls back to the root folder when the type is unknown.
 */
function resolveFolder(type) {
  return FOLDERS[type] || ROOT_FOLDER;
}

/**
 * Upload a file to Cloudinary.
 * @param {object} file - multer file (has .path, .filename, .originalname)
 * @param {string} folder - logical folder name from FOLDERS
 */
async function uploadToCloudinary(file, folder) {
  const options = {
    folder: resolveFolder(folder),
    resource_type: 'image',
    use_filename: true,
    unique_filename: true,
  };

  const transformation = TRANSFORMATIONS[folder];
  if (transformation) options.transformation = transformation;

  const result = await cloudinary.uploader.upload(file.path, options);

  // Remove the local temporary file once Cloudinary stored it.
  try {
    fs.unlinkSync(file.path);
  } catch (_e) {
    /* file already gone */
  }

  return { url: result.secure_url, publicId: result.public_id, storage: 'cloudinary' };
}

/**
 * Development storage: local /uploads folder.
 * Clearly separated from production (Cloudinary) storage.
 */
async function uploadToLocal(file) {
  return {
    url: localFileUrl(file.filename),
    publicId: null,
    storage: 'local',
  };
}

/**
 * Store an uploaded file.
 * - Cloudinary configured  -> upload to Cloudinary.
 * - Not configured, dev    -> local uploads/ fallback.
 * - Not configured, prod   -> fail closed with a safe error.
 *
 * @param {object} file - multer file
 * @param {object} [opts] - { folder } one of FOLDERS keys
 */
async function storeImage(file, opts = {}) {
  if (!file) {
    return { url: null, publicId: null, storage: null };
  }

  if (isConfigured()) {
    try {
      return await uploadToCloudinary(file, opts.folder);
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Image upload is temporarily unavailable. Please try again later.', 502);
      }
      console.warn('[imageService] Cloudinary upload failed, using local fallback:', err.message);
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new AppError('Image upload is temporarily unavailable. Please try again later.', 502);
  }

  return uploadToLocal(file);
}

/**
 * Upload a buffer (in-memory file) directly to Cloudinary.
 * No temporary files are written to disk — ideal for payment screenshots
 * on Render where filesystem storage should be avoided.
 *
 * @param {Buffer} buffer - file content
 * @param {string} originalname - original filename (used for public_id naming only)
 * @param {string} mimetype - MIME type (e.g. 'image/jpeg')
 * @param {object} [opts] - { folder } one of FOLDERS keys
 */
async function storeImageBuffer(buffer, originalname, mimetype, opts = {}) {
  if (!buffer || !buffer.length) {
    return { url: null, publicId: null, storage: null };
  }

  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Image upload is temporarily unavailable. Please try again later.', 502);
    }
    throw new AppError('Image upload requires Cloudinary configuration', 500);
  }

  const folder = resolveFolder(opts.folder);
  const ext = path.extname(originalname || '').toLowerCase() || ALLOWED_MIME_EXT[mimetype] || '.jpg';
  const publicId = `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  const options = {
    folder,
    resource_type: 'image',
    public_id: publicId,
    overwrite: false,
  };

  const transformation = TRANSFORMATIONS[opts.folder];
  if (transformation) options.transformation = transformation;

  // Upload via Promise wrapper for cleaner async/await usage.
  const uploadResult = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    }).end(buffer);
  });

  return { url: uploadResult.secure_url, publicId: uploadResult.public_id, storage: 'cloudinary' };
}

const ALLOWED_MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

async function storeImages(files, opts = {}) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const results = [];
  for (const file of files) {
    results.push(await storeImage(file, opts));
  }
  return results;
}

/**
 * Delete a stored image.
 * - publicId present  -> try Cloudinary (production).
 * - local file        -> remove from uploads/.
 */
async function deleteImage(publicId, url) {
  if (publicId && isConfigured()) {
    try {
      await cloudinary.uploader.destroy(publicId);
      return { deleted: true, storage: 'cloudinary' };
    } catch (err) {
      console.warn('[imageService] Cloudinary delete failed:', err.message);
    }
  }

  if (url && url.includes('/uploads/')) {
    const filename = path.basename(url);
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return { deleted: true, storage: 'local' };
      } catch (err) {
        console.warn('[imageService] Local delete failed:', err.message);
      }
    }
  }

  return { deleted: false };
}

module.exports = {
  storeImage,
  storeImageBuffer,
  storeImages,
  deleteImage,
  isConfigured,
  isRemoteCloudinaryUrl,
  FOLDERS,
  TRANSFORMATIONS,
  API_URL,
};
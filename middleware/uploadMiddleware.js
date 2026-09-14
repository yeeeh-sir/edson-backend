const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const ALLOWED_MIME_SET = new Set(Object.keys(ALLOWED_MIME_TYPES));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext =
      path.extname(file.originalname).toLowerCase() ||
      ALLOWED_MIME_TYPES[file.mimetype] ||
      '.jpg';
    const name = `up-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    return cb(null, true);
  }
  return cb(new Error('Only image files are allowed (jpg, png, webp)'), false);
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter,
});

// Memory storage: file lives in req.file.buffer, never touches disk.
// Used for payment screenshots so no temporary files land on Render's filesystem.
const memoryStorage = multer.memoryStorage();
const memoryUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter,
});

module.exports = {
  upload,
  uploadSingle: (field) => upload.single(field),
  uploadArray: (field, maxCount = 8) => upload.array(field, maxCount),
  uploadSingleMemory: (field) => memoryUpload.single(field),
  uploadsDir,
  ALLOWED_MIME_SET,
};
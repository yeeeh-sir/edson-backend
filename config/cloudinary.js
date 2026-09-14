const cloudinary = require('cloudinary').v2;

// Variable names only — never values. These are also documented in .env.example.
const REQUIRED_VARS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

/**
 * Centralized Cloudinary configuration.
 * Loaded only from backend environment variables — never from the frontend.
 */
function missingCloudinaryVars() {
  return REQUIRED_VARS.filter((name) => !process.env[name]);
}

function isConfigured() {
  return missingCloudinaryVars().length === 0;
}

if (isConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

module.exports = { cloudinary, isConfigured, missingCloudinaryVars };
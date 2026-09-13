const express = require('express');
const router = express.Router();

const {
  getMe,
  updateMe,
  updatePassword,
  uploadProfileImage,
} = require('../controllers/userController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');

router.use(authMiddleware);

router.get('/me', getMe);
router.put('/me', updateMe);
router.put('/me/password', updatePassword);
router.post('/me/profile-image', uploadSingle('profile_image'), uploadProfileImage);

module.exports = router;
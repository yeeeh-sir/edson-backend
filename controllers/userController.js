const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');
const authService = require('../services/authService');
const imageService = require('../services/imageService');

async function getMe(req, res, next) {
  try {
    const user = await authService.getSafeUserById(req.user.id);
    return res.json({ success: true, message: 'Profile retrieved', data: { user } });
  } catch (err) {
    return next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const { full_name, phone, address, city, country } = req.body;

    const allowed = {};
    if (full_name !== undefined) allowed.full_name = String(full_name).trim();
    if (phone !== undefined) allowed.phone = phone ? String(phone).trim() : null;
    if (address !== undefined) allowed.address = address ? String(address).trim() : null;
    if (city !== undefined) allowed.city = city ? String(city).trim() : null;
    if (country !== undefined) allowed.country = country ? String(country).trim() : null;

    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const sets = [];
    const values = [];
    for (const key of Object.keys(allowed)) {
      sets.push(`${key} = ?`);
      values.push(allowed[key]);
    }
    values.push(req.user.id);

    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);

    const user = await authService.getSafeUserById(req.user.id);
    return res.json({ success: true, message: 'Profile updated successfully', data: { user } });
  } catch (err) {
    return next(err);
  }
}

async function updatePassword(req, res, next) {
  try {
    if (req.user.role === 'customer') {
      return res.status(403).json({ success: false, message: 'Customer accounts use Google login' });
    }
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res
        .status(400)
        .json({ success: false, message: 'Current and new password are required' });
    }

    if (String(new_password).length < 6) {
      return res
        .status(400)
        .json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) throw new AppError('User not found', 404);

    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    return next(err);
  }
}

async function uploadProfileImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const [rows] = await pool.query(
      'SELECT profile_image, profile_image_public_id FROM users WHERE id = ?',
      [req.user.id]
    );
    const previous = rows[0] || {};

    const uploaded = await imageService.storeImage(req.file, { folder: 'profiles' });
    await pool.query('UPDATE users SET profile_image = ?, profile_image_public_id = ? WHERE id = ?', [
      uploaded.url,
      uploaded.publicId,
      req.user.id,
    ]);

    // Delete the previous Cloudinary asset only after the replacement was saved.
    // Deletes local (dev) files too, not just Cloudinary assets.
    const hasPrevious = previous.profile_image_public_id || previous.profile_image;
    const isSameAsset = previous.profile_image_public_id && previous.profile_image_public_id === uploaded.publicId;
    if (hasPrevious && !isSameAsset) {
      await imageService.deleteImage(previous.profile_image_public_id, previous.profile_image);
    }

    const user = await authService.getSafeUserById(req.user.id);
    return res.json({
      success: true,
      message: 'Profile image updated',
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getMe, updateMe, updatePassword, uploadProfileImage };
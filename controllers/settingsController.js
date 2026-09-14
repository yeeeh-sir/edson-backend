const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorMiddleware');

const DEFAULTS = {
    shopName: 'Edison Shop',
    tagline: 'Everything You Need, In One Shop',
    currency: 'RWF',
    deliveryFee: '5000',
    freeDeliveryThreshold: '100000',
    email: 'edisonigiraneza@gmail.com',
    phone: '+250 795 031 113',
    address: 'Rubavu District, Rwanda',
};

async function getSettings(_req, res, next) {
    try {
        const [rows] = await pool.query('SELECT setting_key, setting_value FROM store_settings');
        const settings = { ...DEFAULTS };
        rows.forEach((row) => { settings[row.setting_key] = row.setting_value; });
        return res.json({ success: true, message: 'Store settings retrieved', data: { settings } });
    } catch (err) { return next(err); }
}

async function updateSettings(req, res, next) {
    try {
        const allowed = Object.keys(DEFAULTS);
        const entries = Object.entries(req.body).filter(([key, value]) => allowed.includes(key) && value !== undefined);
        if (!entries.length) throw new AppError('No valid settings supplied', 400);
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            for (const [key, value] of entries) {
                const normalized = String(value).trim();
                if (!normalized) throw new AppError(`${key} cannot be empty`, 400);
                if (['deliveryFee', 'freeDeliveryThreshold'].includes(key) && (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) < 0)) {
                    throw new AppError(`${key} must be a valid non-negative amount`, 400);
                }
                await conn.query(
                    'INSERT INTO store_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)',
                    [key, normalized, req.user.id]
                );
            }
            await conn.commit();
        } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
        return getSettings(req, res, next);
    } catch (err) { return next(err); }
}

module.exports = { getSettings, updateSettings };

const mysql = require('mysql2/promise');
const fs = require('fs');

/* ------------------------------------------------------------------ */
/*  Environment helpers                                                */
/* ------------------------------------------------------------------ */

function envBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

/* ------------------------------------------------------------------ */
/*  Sanitised error messages (never include the password)               */
/* ------------------------------------------------------------------ */

function describeConnectionError(error) {
  const raw = (error && error.message) || String(error);
  const password = process.env.DB_PASSWORD || '';
  const safe = password ? raw.split(password).join('[REDACTED]') : raw;

  const host = process.env.DB_HOST || 'localhost';
  const database = process.env.DB_NAME || 'edson_shop';
  const port = process.env.DB_PORT || 3306;

  let hint = '';
  if (error && (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED')) {
    hint = ' — is DB_HOST / DB_PORT reachable from this environment?';
  } else if (error && /ssl/i.test(String(error.message))) {
    hint = ' — check DB_SSL / DB_SSL_CA / DB_SSL_CA_PATH settings.';
  }

  return `[db] connection error: ${safe} (host=${host}, port=${port}, database=${database})${hint}`;
}

/* ------------------------------------------------------------------ */
/*  TLS / SSL configuration (Aiven requires SSL)                       */
/*                                                                      */
/*  Environment variables:                                             */
/*    DB_SSL                  = true  → enable SSL                     */
/*    DB_SSL_REJECT_UNAUTHORIZED = false → skip cert verification      */
/*                            (default: true in production)             */
/*    DB_SSL_CA               = PEM-encoded CA certificate content     */
/*    DB_SSL_CA_PATH          = filesystem path to a .pem CA file      */
/*                                                                      */
/*  When DB_SSL is unset/false, SSL is disabled (local development).   */
/* ------------------------------------------------------------------ */

function buildSslConfig() {
  if (!envBool(process.env.DB_SSL, false)) return undefined;

  const rejectUnauthorized = envBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true);

  if (!rejectUnauthorized) {
    console.warn(
      '[db] WARNING: DB_SSL_REJECT_UNAUTHORIZED is disabled. TLS certificate verification is OFF — this must NOT be used in production.'
    );
  }

  const ssl = { rejectUnauthorized };

  // CA certificate: prefer inline PEM from env var, fall back to file path.
  const caInline = (process.env.DB_SSL_CA || '').trim();
  const caPath = (process.env.DB_SSL_CA_PATH || '').trim();

  let ca;
  if (caInline) {
    ca = caInline;
  } else if (caPath) {
    try {
      ca = fs.readFileSync(caPath, 'utf8');
    } catch (readErr) {
      console.error(`[db] Could not read DB_SSL_CA_PATH "${caPath}": ${readErr.message}`);
    }
  }

  if (ca) ssl.ca = ca;

  return ssl;
}

/* ------------------------------------------------------------------ */
/*  Connection pool                                                    */
/* ------------------------------------------------------------------ */

const pool = mysql.createPool({
  host:               process.env.DB_HOST   || 'localhost',
  user:               process.env.DB_USER   || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME   || 'edson_shop',
  port:               Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  namedPlaceholders:  false,
  timezone:           'Z',
  ssl:                buildSslConfig(),
});

// Log idle-connection errors (e.g. "MySQL server has gone away").
pool.on('error', (err) => {
  console.error(describeConnectionError(err));
});

/* ------------------------------------------------------------------ */
/*  Connectivity test (used by /api/health)                            */
/* ------------------------------------------------------------------ */

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.query('SELECT 1');
      return true;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(describeConnectionError(error));
    throw error;
  }
}

module.exports = { pool, testConnection };

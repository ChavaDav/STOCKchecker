// ─────────────────────────────────────────────────────────────────────────────
// Auth Middleware - Verificación de JWT y gestión de tokens
// ─────────────────────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

/**
 * Genera un par de tokens (access + refresh)
 */
function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      type: 'access',
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRATION, algorithm: 'HS256' }
  );

  const refreshToken = jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
      jti: crypto.randomUUID(),
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRATION, algorithm: 'HS256' }
  );

  // Almacenar hash del refresh token
  const tokenHash = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');
  const decoded = jwt.decode(refreshToken);
  const expiresAt = new Date(decoded.exp * 1000).toISOString();

  db.prepare(`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(user.id, tokenHash, expiresAt);

  return { accessToken, refreshToken };
}

/**
 * Middleware: Autenticación requerida
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Acceso no autorizado',
      message: 'Token de autenticación requerido',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET, {
      algorithms: ['HS256'],
    });

    if (decoded.type !== 'access') {
      throw new Error('Tipo de token inválido');
    }

    req.user = {
      id: decoded.sub,
      username: decoded.username,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Tu sesión ha expirado. Por favor, renueva tu token',
        code: 'TOKEN_EXPIRED',
      });
    }

    logger.security('Token JWT inválido', {
      ip: req.ip,
      error: err.message,
    });

    return res.status(401).json({
      error: 'Token inválido',
      message: 'El token proporcionado no es válido',
    });
  }
}

/**
 * Verifica y rota un refresh token
 */
function verifyRefreshToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET, {
      algorithms: ['HS256'],
    });

    if (decoded.type !== 'refresh') {
      throw new Error('Tipo de token inválido');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const storedToken = db.prepare(`
      SELECT * FROM refresh_tokens
      WHERE token_hash = ? AND revoked = 0
    `).get(tokenHash);

    if (!storedToken) {
      // Posible reutilización de token: revocar toda la familia
      logger.security('Posible reutilización de refresh token detectada', {
        userId: decoded.sub,
      });

      db.prepare(`
        UPDATE refresh_tokens SET revoked = 1
        WHERE user_id = ?
      `).run(decoded.sub);

      throw new Error('Refresh token reutilizado - todos los tokens revocados');
    }

    // Revocar el token actual (rotación)
    db.prepare(`
      UPDATE refresh_tokens SET revoked = 1 WHERE id = ?
    `).run(storedToken.id);

    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('Refresh token expirado');
    }
    throw err;
  }
}

/**
 * Revocar todos los refresh tokens de un usuario
 */
function revokeAllTokens(userId) {
  db.prepare(`
    UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?
  `).run(userId);
}

/**
 * Revocar un refresh token específico
 */
function revokeToken(refreshToken) {
  const tokenHash = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');

  db.prepare(`
    UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?
  `).run(tokenHash);
}

module.exports = {
  generateTokens,
  authenticate,
  verifyRefreshToken,
  revokeAllTokens,
  revokeToken,
};

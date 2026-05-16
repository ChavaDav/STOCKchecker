// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiter Middleware - Protección contra abuso
// ─────────────────────────────────────────────────────────────────────────────
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate limiter general para toda la API
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas solicitudes',
    message: 'Has excedido el límite de solicitudes. Intenta de nuevo más tarde.',
  },
  handler: (req, res, next, options) => {
    logger.security('Rate limit excedido', {
      ip: req.ip,
      path: req.path,
    });
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Rate limiter estricto para rutas de autenticación
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    error: 'Demasiados intentos',
    message:
      'Demasiados intentos de autenticación. Espera 15 minutos antes de intentar de nuevo.',
  },
  handler: (req, res, next, options) => {
    logger.security('Rate limit de autenticación excedido', {
      ip: req.ip,
      path: req.path,
    });
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Rate limiter para consultas a APIs externas (bolsa)
 */
const stockApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiadas consultas',
    message: 'Has hecho demasiadas consultas al mercado. Espera un momento.',
  },
});

module.exports = { generalLimiter, authLimiter, stockApiLimiter };

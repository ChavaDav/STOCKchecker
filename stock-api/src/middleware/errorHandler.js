// ─────────────────────────────────────────────────────────────────────────────
// Error Handler Middleware - Manejo centralizado de errores
// ─────────────────────────────────────────────────────────────────────────────
const logger = require('../utils/logger');

/**
 * Middleware para rutas no encontradas
 */
function notFound(req, res, next) {
  res.status(404).json({
    error: 'No encontrado',
    message: `La ruta ${req.method} ${req.originalUrl} no existe`,
  });
}

/**
 * Middleware global de errores
 */
function errorHandler(err, req, res, next) {
  // Log del error
  logger.error('Error no controlado:', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
  });

  // No filtrar información sensible en producción
  const statusCode = err.statusCode || 500;
  const response = {
    error: statusCode === 500 ? 'Error interno del servidor' : err.message,
    message:
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Ha ocurrido un error. Por favor, intenta más tarde.'
        : err.message,
  };

  // Incluir stack trace solo en desarrollo
  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = { notFound, errorHandler };

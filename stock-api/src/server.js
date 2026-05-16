// ─────────────────────────────────────────────────────────────────────────────
// Server Entry Point - Arranque de la aplicación
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();

const app = require('./app');
const { initializeDatabase } = require('./config/database');
const AlertService = require('./services/alertService');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT) || 3000;

// Verificar variables de entorno requeridas
const requiredEnv = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  logger.error(`Variables de entorno requeridas no configuradas: ${missing.join(', ')}`);
  process.exit(1);
}

// Advertir si se usan secretos por defecto
if (
  process.env.JWT_ACCESS_SECRET?.startsWith('dev_') &&
  process.env.NODE_ENV === 'production'
) {
  logger.error('⚠️  PELIGRO: Usando secretos de desarrollo en producción');
  process.exit(1);
}

// Inicializar base de datos
initializeDatabase();

// Iniciar verificador de alertas
AlertService.start();

// Iniciar servidor
const server = app.listen(PORT, () => {
  logger.info(`
╔══════════════════════════════════════════════════════╗
║          📈 Stock Market API v1.0.0                  ║
║──────────────────────────────────────────────────────║
║  Server:  http://localhost:${PORT}                    ║
║  API:     http://localhost:${PORT}/api                ║
║  Health:  http://localhost:${PORT}/api/health          ║
║  Env:     ${process.env.NODE_ENV || 'development'}                          ║
╚══════════════════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`${signal} recibido. Cerrando servidor...`);

  server.close(() => {
    logger.info('Servidor cerrado correctamente');
    process.exit(0);
  });

  // Forzar cierre después de 10 segundos
  setTimeout(() => {
    logger.error('Cierre forzado del servidor');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason: reason?.message || reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { message: err.message, stack: err.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

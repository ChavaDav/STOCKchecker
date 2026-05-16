// ─────────────────────────────────────────────────────────────────────────────
// Express App Configuration - Configuración central de la aplicación
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const logger = require('./utils/logger');
const { generalLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Importar rutas
const authRoutes = require('./routes/auth');
const stockRoutes = require('./routes/stocks');
const favoriteRoutes = require('./routes/favorites');
const alertRoutes = require('./routes/alerts');

const app = express();

// ─── Security Headers ───────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 600,
  })
);

// ─── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // Limitar tamaño del body
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── HTTP Parameter Pollution Protection ─────────────────────────────────────
app.use(hpp());

// ─── Rate Limiting ───────────────────────────────────────────────────────────
app.use(generalLimiter);

// ─── Request Logging ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: require('../package.json').version,
  });
});

// ─── API Info ────────────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    name: 'Stock Market API',
    version: '1.0.0',
    description:
      'API REST para gestión de acciones bursátiles con alertas y favoritos',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Registrar nuevo usuario',
        'POST /api/auth/login': 'Iniciar sesión',
        'POST /api/auth/refresh': 'Renovar token',
        'POST /api/auth/logout': 'Cerrar sesión',
        'GET /api/auth/me': 'Obtener perfil',
        'PUT /api/auth/me': 'Actualizar perfil',
        'PUT /api/auth/me/password': 'Cambiar contraseña',
      },
      stocks: {
        'GET /api/stocks/search?q=': 'Buscar acciones',
        'GET /api/stocks/market/trending': 'Acciones trending',
        'GET /api/stocks/:symbol': 'Detalle de acción',
        'GET /api/stocks/:symbol/history': 'Historial de precios',
      },
      favorites: {
        'GET /api/favorites': 'Listar favoritos',
        'POST /api/favorites': 'Añadir favorito',
        'DELETE /api/favorites/:symbol': 'Eliminar favorito',
        'GET /api/favorites/prices': 'Precios de favoritos',
      },
      alerts: {
        'GET /api/alerts': 'Listar alertas',
        'POST /api/alerts': 'Crear alerta',
        'PUT /api/alerts/:id': 'Modificar alerta',
        'DELETE /api/alerts/:id': 'Eliminar alerta',
        'GET /api/alerts/triggered': 'Alertas disparadas',
      },
    },
    security: [
      'JWT Authentication (access + refresh tokens)',
      'Rate Limiting',
      'Helmet Security Headers',
      'Input Validation & Sanitization',
      'Brute-force Protection',
      'Audit Logging',
    ],
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/alerts', alertRoutes);

// ─── Error Handling ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;

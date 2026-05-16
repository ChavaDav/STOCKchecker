// ─────────────────────────────────────────────────────────────────────────────
// Auth Routes - Registro, login, refresh, logout, perfil
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const {
  generateTokens,
  authenticate,
  verifyRefreshToken,
  revokeToken,
  revokeAllTokens,
} = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
} = require('../middleware/validation');
const { auditLog } = require('../config/database');
const logger = require('../utils/logger');

/**
 * POST /api/auth/register
 * Registro de nuevo usuario
 */
router.post('/register', authLimiter, registerValidation, async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const user = await User.create({ username, email, password });
    const tokens = generateTokens(user);

    auditLog(user.id, 'REGISTER', { username, email }, req.ip);
    logger.info(`Nuevo usuario registrado: ${username}`);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
      ...tokens,
    });
  } catch (err) {
    if (
      err.message.includes('ya está registrado') ||
      err.message.includes('ya está en uso')
    ) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Inicio de sesión
 */
router.post('/login', authLimiter, loginValidation, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.verifyCredentials(email, password);

    if (!user) {
      auditLog(null, 'LOGIN_FAILED', { email }, req.ip);
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos',
      });
    }

    const tokens = generateTokens(user);
    auditLog(user.id, 'LOGIN', { email }, req.ip);

    res.json({
      message: 'Sesión iniciada exitosamente',
      user,
      ...tokens,
    });
  } catch (err) {
    if (
      err.message.includes('bloqueada') ||
      err.message.includes('desactivada')
    ) {
      return res.status(403).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 * Renovar access token usando refresh token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token requerido',
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = User.findById(decoded.sub);

    if (!user) {
      return res.status(401).json({
        error: 'Usuario no encontrado',
      });
    }

    const tokens = generateTokens(user);
    auditLog(user.id, 'TOKEN_REFRESH', null, req.ip);

    res.json({
      message: 'Token renovado exitosamente',
      ...tokens,
    });
  } catch (err) {
    logger.security('Intento de refresh token fallido', {
      ip: req.ip,
      error: err.message,
    });

    return res.status(401).json({
      error: 'Refresh token inválido',
      message: err.message,
    });
  }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión (revocar refresh token)
 */
router.post('/logout', authenticate, (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    revokeToken(refreshToken);
  }

  // Opción: revocar todos los tokens del usuario
  if (req.body.allDevices) {
    revokeAllTokens(req.user.id);
  }

  auditLog(req.user.id, 'LOGOUT', { allDevices: !!req.body.allDevices }, req.ip);

  res.json({
    message: 'Sesión cerrada exitosamente',
  });
});

/**
 * GET /api/auth/me
 * Obtener perfil del usuario autenticado
 */
router.get('/me', authenticate, (req, res) => {
  const user = User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  res.json({ user });
});

/**
 * PUT /api/auth/me
 * Actualizar perfil del usuario
 */
router.put('/me', authenticate, updateProfileValidation, (req, res, next) => {
  try {
    const { username, email, theme } = req.body;
    const user = User.update(req.user.id, { username, email, theme });

    auditLog(req.user.id, 'PROFILE_UPDATE', { username, email, theme }, req.ip);

    res.json({
      message: 'Perfil actualizado',
      user,
    });
  } catch (err) {
    if (err.message.includes('ya está en uso')) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * PUT /api/auth/me/password
 * Cambiar contraseña
 */
router.put(
  '/me/password',
  authenticate,
  changePasswordValidation,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      await User.changePassword(req.user.id, currentPassword, newPassword);
      auditLog(req.user.id, 'PASSWORD_CHANGE', null, req.ip);

      res.json({
        message:
          'Contraseña actualizada. Todas las sesiones activas han sido cerradas.',
      });
    } catch (err) {
      if (err.message.includes('incorrecta')) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }
);

module.exports = router;

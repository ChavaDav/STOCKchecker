// ─────────────────────────────────────────────────────────────────────────────
// Alert Routes - Gestión de alertas de precio
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createAlertValidation,
  updateAlertValidation,
} = require('../middleware/validation');
const Alert = require('../models/Alert');
const StockService = require('../services/stockService');

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /api/alerts
 * Listar todas las alertas del usuario
 */
router.get('/', (req, res) => {
  const activeOnly = req.query.active === 'true';
  const alerts = Alert.findByUser(req.user.id, { activeOnly });

  res.json({
    count: alerts.length,
    alerts,
  });
});

/**
 * POST /api/alerts
 * Crear una nueva alerta
 */
router.post('/', createAlertValidation, async (req, res, next) => {
  try {
    const { symbol, alertType, targetValue } = req.body;

    // Verificar que el símbolo existe
    let currentQuote;
    try {
      currentQuote = await StockService.getQuote(symbol);
    } catch (err) {
      return res.status(404).json({
        error: `El símbolo ${symbol.toUpperCase()} no existe o no está disponible`,
      });
    }

    const alert = Alert.create(req.user.id, {
      symbol,
      alertType,
      targetValue,
    });

    res.status(201).json({
      message: 'Alerta creada exitosamente',
      alert,
      currentPrice: currentQuote.price,
    });
  } catch (err) {
    if (err.message.includes('límite')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * PUT /api/alerts/:id
 * Modificar una alerta existente
 */
router.put('/:id', updateAlertValidation, (req, res, next) => {
  try {
    const { alertType, targetValue, isActive } = req.body;

    const alert = Alert.update(req.params.id, req.user.id, {
      alertType,
      targetValue,
      isActive,
    });

    if (!alert) {
      return res.status(404).json({
        error: 'Alerta no encontrada',
      });
    }

    res.json({
      message: 'Alerta actualizada',
      alert,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/alerts/:id
 * Eliminar una alerta
 */
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id) || id < 1) {
    return res.status(400).json({ error: 'ID de alerta inválido' });
  }

  const deleted = Alert.delete(id, req.user.id);

  if (!deleted) {
    return res.status(404).json({
      error: 'Alerta no encontrada',
    });
  }

  res.json({
    message: 'Alerta eliminada',
  });
});

/**
 * GET /api/alerts/triggered
 * Obtener alertas que se han disparado
 */
router.get('/triggered', (req, res) => {
  const alerts = Alert.getTriggered(req.user.id);

  res.json({
    count: alerts.length,
    alerts,
  });
});

module.exports = router;

// ─────────────────────────────────────────────────────────────────────────────
// Stock Routes - Búsqueda, cotizaciones, historial y trending
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { stockApiLimiter } = require('../middleware/rateLimiter');
const {
  symbolValidation,
  searchValidation,
} = require('../middleware/validation');
const StockService = require('../services/stockService');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rate limit específico para consultas de bolsa
router.use(stockApiLimiter);

/**
 * GET /api/stocks/search?q=apple
 * Buscar acciones por nombre o símbolo
 */
router.get('/search', searchValidation, async (req, res, next) => {
  try {
    const results = await StockService.search(req.query.q);
    res.json({
      query: req.query.q,
      count: results.length,
      results,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stocks/market/trending
 * Obtener acciones trending / más populares
 */
router.get('/market/trending', async (req, res, next) => {
  try {
    const trending = await StockService.getTrending();
    res.json({
      count: trending.length,
      stocks: trending,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stocks/:symbol
 * Obtener detalle de una acción
 */
router.get('/:symbol', symbolValidation, async (req, res, next) => {
  try {
    const quote = await StockService.getQuote(req.params.symbol);
    res.json(quote);
  } catch (err) {
    if (err.message.includes('No se encontró')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/stocks/:symbol/history?period=1mo&interval=1d
 * Obtener historial de precios
 */
router.get('/:symbol/history', symbolValidation, async (req, res, next) => {
  try {
    const { period, interval } = req.query;
    const history = await StockService.getHistory(
      req.params.symbol,
      period,
      interval
    );
    res.json(history);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

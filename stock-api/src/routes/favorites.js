// ─────────────────────────────────────────────────────────────────────────────
// Favorites Routes - Gestión de acciones favoritas
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { favoriteValidation, symbolValidation } = require('../middleware/validation');
const Favorite = require('../models/Favorite');
const StockService = require('../services/stockService');

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /api/favorites
 * Listar todos los favoritos del usuario
 */
router.get('/', (req, res) => {
  const favorites = Favorite.findByUser(req.user.id);
  res.json({
    count: favorites.length,
    favorites,
  });
});

/**
 * POST /api/favorites
 * Añadir una acción a favoritos
 */
router.post('/', favoriteValidation, async (req, res, next) => {
  try {
    const { symbol, name } = req.body;

    // Verificar que el símbolo existe en el mercado
    try {
      await StockService.getQuote(symbol);
    } catch (err) {
      return res.status(404).json({
        error: `El símbolo ${symbol.toUpperCase()} no existe o no está disponible`,
      });
    }

    const favorite = Favorite.add(req.user.id, symbol, name);

    res.status(201).json({
      message: `${symbol.toUpperCase()} añadido a favoritos`,
      favorite,
    });
  } catch (err) {
    if (err.message.includes('ya está en')) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * DELETE /api/favorites/:symbol
 * Eliminar una acción de favoritos
 */
router.delete('/:symbol', symbolValidation, (req, res) => {
  const removed = Favorite.remove(req.user.id, req.params.symbol);

  if (!removed) {
    return res.status(404).json({
      error: 'Acción no encontrada en tus favoritos',
    });
  }

  res.json({
    message: `${req.params.symbol.toUpperCase()} eliminado de favoritos`,
  });
});

/**
 * GET /api/favorites/prices
 * Obtener precios actuales de todas las acciones favoritas
 */
router.get('/prices', async (req, res, next) => {
  try {
    const symbols = Favorite.getSymbols(req.user.id);

    if (symbols.length === 0) {
      return res.json({
        message: 'No tienes acciones en favoritos',
        count: 0,
        stocks: [],
      });
    }

    const quotes = await StockService.getMultipleQuotes(symbols);

    res.json({
      count: quotes.length,
      stocks: quotes,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

// ─────────────────────────────────────────────────────────────────────────────
// Stock Service - Integración directa con Yahoo Finance API (HTTP)
// Usa las APIs públicas de Yahoo Finance sin dependencia de librerías externas
// ─────────────────────────────────────────────────────────────────────────────
const logger = require('../utils/logger');

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── Cache simple en memoria ─────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minuto

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data, ttl = CACHE_TTL) {
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

// ─── Custom Error for API availability ──────────────────────────────────────
class YahooApiError extends Error {
  constructor(message, statusCode = 503) {
    super(message);
    this.name = 'YahooApiError';
    this.statusCode = statusCode;
  }
}

// ─── HTTP Helper con reintentos ──────────────────────────────────────────────
const HOSTS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];

async function yahooFetch(path, retries = 3) {
  let lastError;
  let got429 = false;

  for (let attempt = 0; attempt < retries; attempt++) {
    for (const host of HOSTS) {
      try {
        const url = `${host}${path}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
          },
        });

        if (response.status === 429) {
          got429 = true;
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
          logger.debug(`Yahoo 429 rate limit, esperando ${waitMs}ms (intento ${attempt + 1}/${retries})`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        if (!response.ok) {
          throw new Error(
            `Yahoo API error: ${response.status} ${response.statusText}`
          );
        }

        return await response.json();
      } catch (err) {
        lastError = err;
        if (!err.message.includes('Yahoo API error')) {
          logger.debug(`Error con ${host}, probando siguiente`, {
            error: err.message,
          });
        }
      }
    }
  }

  if (got429) {
    throw new YahooApiError(
      'Servicio de datos bursátiles temporalmente no disponible. Intenta de nuevo en unos minutos.'
    );
  }
  throw lastError || new YahooApiError('Servicio de datos bursátiles no disponible');
}

// ─── Stock Service ───────────────────────────────────────────────────────────
class StockService {
  /**
   * Buscar acciones por nombre o símbolo
   * Usa la API de búsqueda v1
   */
  static async search(query) {
    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await yahooFetch(
        `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0`
      );

      const results = (data.quotes || [])
        .filter((q) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
        .map((q) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          type: q.quoteType,
          exchange: q.exchDisp || q.exchange,
          sector: q.sector || null,
        }));

      setCache(cacheKey, results, 5 * 60 * 1000); // Cache 5 min para búsquedas
      return results;
    } catch (err) {
      logger.error('Error buscando acciones:', { query, error: err.message });
      throw new Error('Error al buscar acciones. Intenta de nuevo.');
    }
  }

  /**
   * Obtener detalle/cotización de una acción
   * Usa la API chart v8 que es la más fiable
   */
  static async getQuote(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `quote:${upperSymbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await yahooFetch(
        `/v8/finance/chart/${encodeURIComponent(upperSymbol)}?interval=1d&range=5d&includePrePost=false`
      );

      const chartResult = data.chart?.result?.[0];
      if (!chartResult) {
        throw new Error(`No se encontró la acción ${symbol}`);
      }

      const meta = chartResult.meta;
      const indicators = chartResult.indicators?.quote?.[0] || {};
      const timestamps = chartResult.timestamp || [];

      // Calcular cambio desde el cierre anterior
      const currentPrice = meta.regularMarketPrice;
      const previousClose = meta.chartPreviousClose || meta.previousClose;
      const change = previousClose ? currentPrice - previousClose : null;
      const changePercent = previousClose
        ? ((change / previousClose) * 100)
        : null;

      // Datos del último día de trading
      const lastIdx = timestamps.length - 1;
      const dayHigh =
        lastIdx >= 0 ? indicators.high?.[lastIdx] : null;
      const dayLow =
        lastIdx >= 0 ? indicators.low?.[lastIdx] : null;
      const dayOpen =
        lastIdx >= 0 ? indicators.open?.[lastIdx] : null;
      const dayVolume =
        lastIdx >= 0 ? indicators.volume?.[lastIdx] : null;

      // Calcular high/low del rango disponible
      const allHighs = (indicators.high || []).filter((v) => v != null);
      const allLows = (indicators.low || []).filter((v) => v != null);

      const result = {
        symbol: meta.symbol,
        name: meta.shortName || meta.longName || meta.symbol,
        price: currentPrice,
        currency: meta.currency,
        change: change ? parseFloat(change.toFixed(4)) : null,
        changePercent: changePercent
          ? parseFloat(changePercent.toFixed(2))
          : null,
        volume: dayVolume,
        dayHigh,
        dayLow,
        open: dayOpen,
        previousClose,
        exchange: meta.exchangeName,
        marketState: meta.marketState || null,
        timezone: meta.timezone,
        tradingPeriod: meta.currentTradingPeriod
          ? {
              start: new Date(
                meta.currentTradingPeriod.regular?.start * 1000
              ).toISOString(),
              end: new Date(
                meta.currentTradingPeriod.regular?.end * 1000
              ).toISOString(),
            }
          : null,
        rangeHigh: allHighs.length ? Math.max(...allHighs) : null,
        rangeLow: allLows.length ? Math.min(...allLows) : null,
        updatedAt: meta.regularMarketTime
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : null,
      };

      setCache(cacheKey, result);
      return result;
    } catch (err) {
      if (err.message.includes('No se encontró')) throw err;
      logger.error('Error obteniendo cotización:', {
        symbol,
        error: err.message,
      });
      throw new Error(`Error al obtener datos de ${symbol}`);
    }
  }

  /**
   * Obtener historial de precios
   */
  static async getHistory(symbol, period = '1mo', interval = '1d') {
    const upperSymbol = symbol.toUpperCase();

    const validPeriods = [
      '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max',
    ];
    const validIntervals = [
      '1m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo',
    ];

    if (!validPeriods.includes(period)) period = '1mo';
    if (!validIntervals.includes(interval)) interval = '1d';

    const cacheKey = `history:${upperSymbol}:${period}:${interval}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await yahooFetch(
        `/v8/finance/chart/${encodeURIComponent(upperSymbol)}?interval=${interval}&range=${period}&includePrePost=false`
      );

      const chartResult = data.chart?.result?.[0];
      if (!chartResult) {
        throw new Error('No hay datos históricos disponibles');
      }

      const meta = chartResult.meta;
      const timestamps = chartResult.timestamp || [];
      const indicators = chartResult.indicators?.quote?.[0] || {};

      const historyData = timestamps.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString(),
        open: indicators.open?.[i] || null,
        high: indicators.high?.[i] || null,
        low: indicators.low?.[i] || null,
        close: indicators.close?.[i] || null,
        volume: indicators.volume?.[i] || null,
      }));

      const result = {
        symbol: meta.symbol,
        currency: meta.currency,
        exchange: meta.exchangeName,
        period,
        interval,
        dataPoints: historyData.length,
        data: historyData,
      };

      setCache(cacheKey, result, 2 * 60 * 1000); // Cache 2 min para historial
      return result;
    } catch (err) {
      logger.error('Error obteniendo historial:', {
        symbol,
        error: err.message,
      });
      throw new Error(`Error al obtener historial de ${symbol}`);
    }
  }

  /**
   * Obtener acciones trending / más populares
   */
  static async getTrending() {
    const cacheKey = 'trending';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      // Intentar API de trending
      try {
        const data = await yahooFetch(
          '/v1/finance/trending/US?count=15'
        );

        const trendingSymbols = (
          data.finance?.result?.[0]?.quotes || []
        )
          .map((q) => q.symbol)
          .slice(0, 10);

        if (trendingSymbols.length > 0) {
          const results = await this.getMultipleQuotes(trendingSymbols);
          if (results.length > 0) {
            setCache(cacheKey, results, 5 * 60 * 1000);
            return results;
          }
        }
      } catch (e) {
        logger.debug('Trending API no disponible, usando fallback', {
          error: e.message,
        });
      }

      // Fallback: acciones populares predefinidas
      const fallbackSymbols = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
        'META', 'TSLA', 'JPM', 'V', 'JNJ',
      ];

      const results = await this.getMultipleQuotes(fallbackSymbols);
      setCache(cacheKey, results, 5 * 60 * 1000);
      return results;
    } catch (err) {
      logger.error('Error obteniendo trending:', { error: err.message });
      throw new Error('Error al obtener acciones populares');
    }
  }

  /**
   * Obtener precio actual de un símbolo (para el alert checker)
   */
  static async getCurrentPrice(symbol) {
    try {
      const quote = await this.getQuote(symbol);
      return quote?.price || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Obtener precios de múltiples símbolos
   * Procesa en paralelo con límite de concurrencia
   */
  static async getMultipleQuotes(symbols) {
    if (!symbols || symbols.length === 0) return [];

    const results = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map((symbol) => this.getQuote(symbol))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          const q = result.value;
          results.push({
            symbol: q.symbol,
            name: q.name,
            price: q.price,
            change: q.change,
            changePercent: q.changePercent,
            volume: q.volume,
            currency: q.currency,
          });
        }
      }
    }

    return results;
  }
}

module.exports = StockService;

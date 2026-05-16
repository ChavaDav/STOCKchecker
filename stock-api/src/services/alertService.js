// ─────────────────────────────────────────────────────────────────────────────
// Alert Service - Verificación periódica de alertas de precio
// ─────────────────────────────────────────────────────────────────────────────
const cron = require('node-cron');
const Alert = require('../models/Alert');
const StockService = require('./stockService');
const logger = require('../utils/logger');

class AlertService {
  /**
   * Inicia el job periódico de verificación de alertas
   * Se ejecuta cada 5 minutos durante horario de mercado
   */
  static start() {
    // Cada 5 minutos, de lunes a viernes
    cron.schedule('*/5 * * * 1-5', async () => {
      await this.checkAlerts();
    });

    logger.info('🔔 Alert checker iniciado (cada 5 min, L-V)');
  }

  /**
   * Verifica todas las alertas activas contra precios actuales
   */
  static async checkAlerts() {
    try {
      const activeAlerts = Alert.getAllActive();

      if (activeAlerts.length === 0) return;

      // Agrupar alertas por símbolo para minimizar llamadas API
      const symbolMap = {};
      for (const alert of activeAlerts) {
        if (!symbolMap[alert.symbol]) {
          symbolMap[alert.symbol] = [];
        }
        symbolMap[alert.symbol].push(alert);
      }

      const symbols = Object.keys(symbolMap);
      logger.debug(`Verificando alertas para ${symbols.length} símbolos`);

      // Obtener precios en lote (de 10 en 10)
      for (let i = 0; i < symbols.length; i += 10) {
        const batch = symbols.slice(i, i + 10);

        try {
          const quotes = await StockService.getMultipleQuotes(batch);

          for (const quote of quotes) {
            const alerts = symbolMap[quote.symbol] || [];

            for (const alert of alerts) {
              const triggered = this.evaluateAlert(alert, quote);

              if (triggered) {
                Alert.trigger(alert.id, quote.price);
                logger.info(
                  `🔔 Alerta disparada: ${alert.symbol} ${alert.alert_type} ${alert.target_value} (actual: ${quote.price})`,
                  {
                    alertId: alert.id,
                    userId: alert.user_id,
                    username: alert.username,
                  }
                );
              }
            }
          }
        } catch (err) {
          logger.error('Error verificando lote de alertas:', {
            batch,
            error: err.message,
          });
        }
      }
    } catch (err) {
      logger.error('Error en el checker de alertas:', { error: err.message });
    }
  }

  /**
   * Evalúa si una alerta se ha disparado
   */
  static evaluateAlert(alert, quote) {
    const price = quote.price;
    if (!price) return false;

    switch (alert.alert_type) {
      case 'above':
        return price >= alert.target_value;

      case 'below':
        return price <= alert.target_value;

      case 'percent_change':
        // Porcentaje de cambio respecto al cierre anterior
        const changePercent = Math.abs(quote.changePercent || 0);
        return changePercent >= alert.target_value;

      default:
        return false;
    }
  }
}

module.exports = AlertService;

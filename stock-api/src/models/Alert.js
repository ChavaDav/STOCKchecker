// ─────────────────────────────────────────────────────────────────────────────
// Alert Model - Gestión de alertas de precio
// ─────────────────────────────────────────────────────────────────────────────
const { db } = require('../config/database');

const MAX_ALERTS_PER_USER = 20;

class Alert {
  /**
   * Obtener todas las alertas de un usuario
   */
  static findByUser(userId, { activeOnly = false } = {}) {
    let query = `
      SELECT * FROM alerts
      WHERE user_id = ?
    `;
    if (activeOnly) {
      query += ' AND is_active = 1 AND is_triggered = 0';
    }
    query += ' ORDER BY created_at DESC';

    return db.prepare(query).all(userId);
  }

  /**
   * Obtener una alerta por ID (verificando que pertenece al usuario)
   */
  static findByIdAndUser(id, userId) {
    return db.prepare(`
      SELECT * FROM alerts
      WHERE id = ? AND user_id = ?
    `).get(id, userId);
  }

  /**
   * Crear una nueva alerta
   */
  static create(userId, { symbol, alertType, targetValue }) {
    // Verificar límite de alertas
    const count = db.prepare(`
      SELECT COUNT(*) as total FROM alerts
      WHERE user_id = ? AND is_active = 1
    `).get(userId);

    if (count.total >= MAX_ALERTS_PER_USER) {
      throw new Error(
        `Has alcanzado el límite máximo de ${MAX_ALERTS_PER_USER} alertas activas`
      );
    }

    const result = db.prepare(`
      INSERT INTO alerts (user_id, symbol, alert_type, target_value)
      VALUES (?, ?, ?, ?)
    `).run(userId, symbol.toUpperCase(), alertType, targetValue);

    return db.prepare('SELECT * FROM alerts WHERE id = ?').get(
      result.lastInsertRowid
    );
  }

  /**
   * Actualizar una alerta
   */
  static update(id, userId, { alertType, targetValue, isActive }) {
    const alert = this.findByIdAndUser(id, userId);
    if (!alert) return null;

    const updates = [];
    const values = [];

    if (alertType !== undefined) {
      updates.push('alert_type = ?');
      values.push(alertType);
    }
    if (targetValue !== undefined) {
      updates.push('target_value = ?');
      values.push(targetValue);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
      // Si se reactiva, resetear el trigger
      if (isActive) {
        updates.push('is_triggered = 0');
        updates.push('triggered_at = NULL');
        updates.push('triggered_price = NULL');
      }
    }

    if (updates.length === 0) return alert;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, userId);

    db.prepare(`
      UPDATE alerts 
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `).run(...values);

    return this.findByIdAndUser(id, userId);
  }

  /**
   * Eliminar una alerta
   */
  static delete(id, userId) {
    const result = db.prepare(`
      DELETE FROM alerts WHERE id = ? AND user_id = ?
    `).run(id, userId);

    return result.changes > 0;
  }

  /**
   * Obtener alertas disparadas de un usuario
   */
  static getTriggered(userId) {
    return db.prepare(`
      SELECT * FROM alerts
      WHERE user_id = ? AND is_triggered = 1
      ORDER BY triggered_at DESC
    `).all(userId);
  }

  /**
   * Obtener todas las alertas activas (para el checker)
   */
  static getAllActive() {
    return db.prepare(`
      SELECT a.*, u.email, u.username
      FROM alerts a
      JOIN users u ON a.user_id = u.id
      WHERE a.is_active = 1 AND a.is_triggered = 0 AND u.is_active = 1
    `).all();
  }

  /**
   * Marcar una alerta como disparada
   */
  static trigger(id, currentPrice) {
    db.prepare(`
      UPDATE alerts 
      SET is_triggered = 1, triggered_at = CURRENT_TIMESTAMP, triggered_price = ?
      WHERE id = ?
    `).run(currentPrice, id);
  }
}

module.exports = Alert;

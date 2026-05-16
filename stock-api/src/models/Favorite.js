// ─────────────────────────────────────────────────────────────────────────────
// Favorite Model - Gestión de acciones favoritas por usuario
// ─────────────────────────────────────────────────────────────────────────────
const { db } = require('../config/database');

class Favorite {
  /**
   * Obtener todos los favoritos de un usuario
   */
  static findByUser(userId) {
    return db.prepare(`
      SELECT id, symbol, name, added_at
      FROM favorites
      WHERE user_id = ?
      ORDER BY added_at DESC
    `).all(userId);
  }

  /**
   * Añadir un favorito
   */
  static add(userId, symbol, name = null) {
    try {
      const result = db.prepare(`
        INSERT INTO favorites (user_id, symbol, name)
        VALUES (?, ?, ?)
      `).run(userId, symbol.toUpperCase(), name);

      return db.prepare('SELECT * FROM favorites WHERE id = ?').get(
        result.lastInsertRowid
      );
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Esta acción ya está en tus favoritos');
      }
      throw err;
    }
  }

  /**
   * Eliminar un favorito
   */
  static remove(userId, symbol) {
    const result = db.prepare(`
      DELETE FROM favorites
      WHERE user_id = ? AND symbol = ?
    `).run(userId, symbol.toUpperCase());

    return result.changes > 0;
  }

  /**
   * Verificar si un símbolo está en favoritos
   */
  static exists(userId, symbol) {
    const row = db.prepare(`
      SELECT id FROM favorites
      WHERE user_id = ? AND symbol = ?
    `).get(userId, symbol.toUpperCase());

    return !!row;
  }

  /**
   * Obtener solo los símbolos favoritos de un usuario
   */
  static getSymbols(userId) {
    return db
      .prepare('SELECT symbol FROM favorites WHERE user_id = ?')
      .all(userId)
      .map((row) => row.symbol);
  }
}

module.exports = Favorite;

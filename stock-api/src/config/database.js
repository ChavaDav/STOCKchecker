// ─────────────────────────────────────────────────────────────────────────────
// Database Configuration - SQLite con better-sqlite3
// ─────────────────────────────────────────────────────────────────────────────
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const dbPath = path.resolve(process.env.DB_PATH || './data/stock-api.db');
const dbDir = path.dirname(dbPath);

// Crear directorio si no existe
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Configuración de seguridad y rendimiento
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/**
 * Inicializa las tablas de la base de datos
 */
function initializeDatabase() {
  db.exec(`
    -- Tabla de usuarios
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      theme TEXT DEFAULT 'dark',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME DEFAULT NULL
    );

    -- Migración para añadir theme si la base de datos ya existía
    BEGIN TRANSACTION;
    SELECT * FROM users LIMIT 1;
    COMMIT;
  `);

  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasTheme = tableInfo.some(column => column.name === 'theme');
    if (!hasTheme) {
      db.prepare("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'").run();
      logger.info('Migración: Columna theme añadida a la tabla users');
    }
  } catch (err) {
    logger.error('Error en migración de theme:', err);
  }

  db.exec(`
    -- Índices para usuarios
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    -- Tabla de refresh tokens (para invalidación)
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked INTEGER DEFAULT 0,
      replaced_by TEXT DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

    -- Tabla de favoritos
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      name TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, symbol)
    );

    CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

    -- Tabla de alertas
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      alert_type TEXT NOT NULL CHECK(alert_type IN ('above', 'below', 'percent_change')),
      target_value REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      is_triggered INTEGER DEFAULT 0,
      triggered_at DATETIME DEFAULT NULL,
      triggered_price REAL DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active, is_triggered);

    -- Tabla de log de auditoría
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
  `);

  // Limpiar tokens expirados periódicamente
  db.prepare(`
    DELETE FROM refresh_tokens 
    WHERE expires_at < datetime('now') OR revoked = 1
  `).run();

  logger.info('Base de datos inicializada correctamente');
}

/**
 * Registra una acción en el log de auditoría
 */
function auditLog(userId, action, details, ipAddress) {
  try {
    db.prepare(`
      INSERT INTO audit_log (user_id, action, details, ip_address)
      VALUES (?, ?, ?, ?)
    `).run(userId, action, JSON.stringify(details), ipAddress);
  } catch (err) {
    logger.error('Error registrando auditoría:', err);
  }
}

module.exports = { db, initializeDatabase, auditLog };

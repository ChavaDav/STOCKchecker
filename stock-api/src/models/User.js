// ─────────────────────────────────────────────────────────────────────────────
// User Model - Operaciones CRUD para usuarios con seguridad
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require('bcrypt');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

class User {
  /**
   * Crear un nuevo usuario
   */
  static async create({ username, email, password }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash)
      VALUES (?, ?, ?)
    `);

    try {
      const result = stmt.run(username, email.toLowerCase(), passwordHash);
      logger.info(`Usuario creado: ${username} (ID: ${result.lastInsertRowid})`);
      return this.findById(result.lastInsertRowid);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        if (err.message.includes('email')) {
          throw new Error('El email ya está registrado');
        }
        if (err.message.includes('username')) {
          throw new Error('El nombre de usuario ya está en uso');
        }
      }
      throw err;
    }
  }

  /**
   * Buscar usuario por ID (sin password)
   */
  static findById(id) {
    return db.prepare(`
      SELECT id, username, email, theme, created_at, updated_at, is_active
      FROM users WHERE id = ?
    `).get(id);
  }

  /**
   * Buscar usuario por email (con password para autenticación)
   */
  static findByEmail(email) {
    return db.prepare(`
      SELECT * FROM users WHERE email = ? COLLATE NOCASE
    `).get(email.toLowerCase());
  }

  /**
   * Buscar usuario por username
   */
  static findByUsername(username) {
    return db.prepare(`
      SELECT * FROM users WHERE username = ? COLLATE NOCASE
    `).get(username);
  }

  /**
   * Verificar credenciales con protección contra fuerza bruta
   */
  static async verifyCredentials(email, password) {
    const user = this.findByEmail(email);

    if (!user) {
      // Ejecutar hash para evitar timing attacks
      await bcrypt.hash(password, SALT_ROUNDS);
      return null;
    }

    // Verificar si la cuenta está bloqueada
    if (user.locked_until) {
      const lockExpiry = new Date(user.locked_until);
      if (lockExpiry > new Date()) {
        const minutesLeft = Math.ceil((lockExpiry - new Date()) / 60000);
        logger.security('Intento de login en cuenta bloqueada', {
          email,
          minutesLeft,
        });
        throw new Error(
          `Cuenta bloqueada. Intenta de nuevo en ${minutesLeft} minutos`
        );
      }
      // El bloqueo ha expirado, resetear
      db.prepare(`
        UPDATE users SET failed_login_attempts = 0, locked_until = NULL
        WHERE id = ?
      `).run(user.id);
    }

    if (!user.is_active) {
      throw new Error('La cuenta está desactivada');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      const attempts = user.failed_login_attempts + 1;

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(
          Date.now() + LOCK_DURATION_MINUTES * 60000
        ).toISOString();
        db.prepare(`
          UPDATE users 
          SET failed_login_attempts = ?, locked_until = ?
          WHERE id = ?
        `).run(attempts, lockUntil, user.id);

        logger.security('Cuenta bloqueada por demasiados intentos fallidos', {
          email,
          attempts,
        });
        throw new Error(
          `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCK_DURATION_MINUTES} minutos`
        );
      }

      db.prepare(`
        UPDATE users SET failed_login_attempts = ? WHERE id = ?
      `).run(attempts, user.id);

      logger.security('Intento de login fallido', { email, attempts });
      return null;
    }

    // Login exitoso: resetear contador
    db.prepare(`
      UPDATE users 
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE id = ?
    `).run(user.id);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      theme: user.theme,
      created_at: user.created_at,
    };
  }

  /**
   * Actualizar perfil de usuario
   */
  static update(id, { username, email, theme }) {
    const updates = [];
    const values = [];

    if (username) {
      updates.push('username = ?');
      values.push(username);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email.toLowerCase());
    }
    if (theme) {
      updates.push('theme = ?');
      values.push(theme);
    }

    if (updates.length === 0) return this.findById(id);

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    try {
      db.prepare(`
        UPDATE users SET ${updates.join(', ')} WHERE id = ?
      `).run(...values);

      return this.findById(id);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('El email o nombre de usuario ya está en uso');
      }
      throw err;
    }
  }

  /**
   * Cambiar contraseña
   */
  static async changePassword(id, currentPassword, newPassword) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

    if (!user) throw new Error('Usuario no encontrado');

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      logger.security('Intento de cambio de contraseña fallido', {
        userId: id,
      });
      throw new Error('La contraseña actual es incorrecta');
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newHash, id);

    // Invalidar todos los refresh tokens existentes
    db.prepare(`
      UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?
    `).run(id);

    logger.info(`Contraseña cambiada para usuario ID: ${id}`);
    return true;
  }
}

module.exports = User;

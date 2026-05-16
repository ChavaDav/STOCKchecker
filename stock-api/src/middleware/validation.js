// ─────────────────────────────────────────────────────────────────────────────
// Validation Middleware - Reglas de validación con express-validator
// ─────────────────────────────────────────────────────────────────────────────
const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware que procesa los errores de validación
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Datos de entrada inválidos',
      details: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
}

/**
 * Validaciones para registro de usuario
 */
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('El nombre de usuario debe tener entre 3 y 30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(
      'El nombre de usuario solo puede contener letras, números y guiones bajos'
    )
    .escape(),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('El email es demasiado largo'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('La contraseña debe tener entre 8 y 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.,;:_\-#])[A-Za-z\d@$!%*?&.,;:_\-#]+$/)
    .withMessage(
      'La contraseña debe incluir mayúscula, minúscula, número y carácter especial'
    ),

  handleValidation,
];

/**
 * Validaciones para login
 */
const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
    .isLength({ max: 128 })
    .withMessage('Contraseña demasiado larga'),

  handleValidation,
];

/**
 * Validaciones para actualización de perfil
 */
const updateProfileValidation = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('El nombre de usuario debe tener entre 3 y 30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Solo letras, números y guiones bajos')
    .escape(),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),

  handleValidation,
];

/**
 * Validaciones para cambio de contraseña
 */
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('La nueva contraseña debe tener entre 8 y 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.,;:_\-#])[A-Za-z\d@$!%*?&.,;:_\-#]+$/)
    .withMessage(
      'Debe incluir mayúscula, minúscula, número y carácter especial'
    )
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error(
          'La nueva contraseña debe ser diferente a la actual'
        );
      }
      return true;
    }),

  handleValidation,
];

/**
 * Validaciones para símbolo de acción
 */
const symbolValidation = [
  param('symbol')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Símbolo inválido')
    .matches(/^[A-Za-z0-9.^=]+$/)
    .withMessage('Símbolo contiene caracteres no permitidos'),

  handleValidation,
];

/**
 * Validaciones para búsqueda
 */
const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('El término de búsqueda debe tener entre 1 y 50 caracteres')
    .escape(),

  handleValidation,
];

/**
 * Validaciones para favoritos
 */
const favoriteValidation = [
  body('symbol')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Símbolo inválido')
    .matches(/^[A-Za-z0-9.^=]+$/)
    .withMessage('Símbolo contiene caracteres no permitidos'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('El nombre es demasiado largo')
    .escape(),

  handleValidation,
];

/**
 * Validaciones para crear alerta
 */
const createAlertValidation = [
  body('symbol')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Símbolo inválido')
    .matches(/^[A-Za-z0-9.^=]+$/)
    .withMessage('Símbolo contiene caracteres no permitidos'),

  body('alertType')
    .isIn(['above', 'below', 'percent_change'])
    .withMessage('Tipo de alerta inválido. Valores: above, below, percent_change'),

  body('targetValue')
    .isFloat({ min: 0.0001 })
    .withMessage('El valor objetivo debe ser un número positivo'),

  handleValidation,
];

/**
 * Validaciones para actualizar alerta
 */
const updateAlertValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID de alerta inválido'),

  body('alertType')
    .optional()
    .isIn(['above', 'below', 'percent_change'])
    .withMessage('Tipo de alerta inválido'),

  body('targetValue')
    .optional()
    .isFloat({ min: 0.0001 })
    .withMessage('El valor objetivo debe ser un número positivo'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser un booleano'),

  handleValidation,
];

module.exports = {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  symbolValidation,
  searchValidation,
  favoriteValidation,
  createAlertValidation,
  updateAlertValidation,
  handleValidation,
};

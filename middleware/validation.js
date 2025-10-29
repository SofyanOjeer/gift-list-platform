const { body, validationResult } = require('express-validator');

const validateList = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Le nom doit contenir entre 1 et 100 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La description ne peut pas dépasser 500 caractères'),
  body('visibility')
    .isIn(['public', 'private', 'unlisted'])
    .withMessage('Visibilité invalide'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('list-create', {
        errors: errors.array(),
        formData: req.body
      });
    }
    next();
  }
];

const validateItem = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Le nom doit contenir entre 1 et 255 caractères'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le prix doit être un nombre positif'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('La quantité doit être au moins 1'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = {
  validateList,
  validateItem
};
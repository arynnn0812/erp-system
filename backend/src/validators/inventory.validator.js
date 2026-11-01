const { body, param, query } = require('express-validator');

const categoryRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),
];

const productRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('sku').trim().notEmpty().withMessage('SKU is required').isLength({ max: 50 }),
  body('categoryId').isInt({ min: 1 }).withMessage('categoryId must be a positive integer').toInt(),
  body('price').isFloat({ min: 0 }).withMessage('price must be >= 0').toFloat(),
  body('quantity').optional().isInt({ min: 0 }).withMessage('quantity must be >= 0').toInt(),
  body('reorderLevel').optional().isInt({ min: 0 }).withMessage('reorderLevel must be >= 0').toInt(),
  body('supplier').optional().trim().isLength({ max: 150 }),
];

const stockRules = [
  param('id').isInt({ min: 1 }),
  body('type').isIn(['IN', 'OUT']).withMessage("type must be 'IN' or 'OUT'"),
  body('quantity').isInt({ min: 1 }).withMessage('quantity must be a positive integer').toInt(),
  body('reference').optional().trim().isLength({ max: 100 }),
];

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }), // cap page size
  query('categoryId').optional().isInt({ min: 1 }),
];

const reorderRules = [
  query('days').optional().isInt({ min: 7, max: 365 }).withMessage('days must be 7-365').toInt(),
  query('cover').optional().isInt({ min: 1, max: 365 }).withMessage('cover must be 1-365').toInt(),
  query('leadTime').optional().isInt({ min: 0, max: 180 }).withMessage('leadTime must be 0-180').toInt(),
];

const idRule = [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')];

module.exports = { categoryRules, productRules, stockRules, listRules, idRule, reorderRules };

const categoryModel = require('../models/category.model');
const inventoryService = require('../services/inventory.service');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const categories = await categoryModel.listAll();
  res.json({ success: true, data: categories });
});

const create = asyncHandler(async (req, res) => {
  const id = await inventoryService.createCategory(req.body.name);
  res.status(201).json({ success: true, data: { id, name: req.body.name } });
});

const update = asyncHandler(async (req, res) => {
  await inventoryService.updateCategory(req.params.id, req.body.name);
  res.json({ success: true, message: 'Category updated' });
});

const remove = asyncHandler(async (req, res) => {
  await inventoryService.deleteCategory(req.params.id);
  res.json({ success: true, message: 'Category deleted' });
});

module.exports = { list, create, update, remove };

const customerModel = require('../models/customer.model');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const result = await customerModel.list({ search, page: Number(page), limit: Number(limit) });
  res.json({ success: true, ...result });
});

const getOne = asyncHandler(async (req, res) => {
  const customer = await customerModel.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  res.json({ success: true, data: customer });
});

const create = asyncHandler(async (req, res) => {
  const id = await customerModel.create(req.body);
  res.status(201).json({ success: true, data: { id } });
});

const update = asyncHandler(async (req, res) => {
  const ok = await customerModel.update(req.params.id, req.body);
  if (!ok) throw new ApiError(404, 'Customer not found');
  res.json({ success: true, message: 'Customer updated' });
});

module.exports = { list, getOne, create, update };

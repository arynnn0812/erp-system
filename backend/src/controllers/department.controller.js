const departmentModel = require('../models/department.model');
const hrService = require('../services/hr.service');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const departments = await departmentModel.listAll();
  res.json({ success: true, data: departments });
});

const create = asyncHandler(async (req, res) => {
  const id = await hrService.createDepartment(req.body.name);
  res.status(201).json({ success: true, data: { id, name: req.body.name } });
});

const update = asyncHandler(async (req, res) => {
  await hrService.updateDepartment(req.params.id, req.body.name);
  res.json({ success: true, message: 'Department updated' });
});

const remove = asyncHandler(async (req, res) => {
  await hrService.deleteDepartment(req.params.id);
  res.json({ success: true, message: 'Department deleted' });
});

module.exports = { list, create, update, remove };

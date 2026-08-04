const employeeModel = require('../models/employee.model');
const hrService = require('../services/hr.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// GET /api/employees?departmentId=&search=&page=&limit=
// The MODEL decides which fields the role may see (salary only for ADMIN/HR).
const list = asyncHandler(async (req, res) => {
  const { departmentId, search, page = 1, limit = 10 } = req.query;
  const result = await employeeModel.list(
    { departmentId, search, page: Number(page), limit: Number(limit) },
    req.user.role
  );
  res.json({ success: true, ...result });
});

const getOne = asyncHandler(async (req, res) => {
  const employee = await employeeModel.findById(req.params.id, req.user.role);
  if (!employee) throw new ApiError(404, 'Employee not found');
  res.json({ success: true, data: employee });
});

const create = asyncHandler(async (req, res) => {
  const id = await hrService.createEmployee(req.body, req.user, req.ip);
  res.status(201).json({ success: true, data: { id } });
});

const update = asyncHandler(async (req, res) => {
  await hrService.updateEmployee(req.params.id, req.body, req.user, req.ip);
  res.json({ success: true, message: 'Employee updated' });
});

const remove = asyncHandler(async (req, res) => {
  await hrService.deleteEmployee(req.params.id, req.user, req.ip);
  res.json({ success: true, message: 'Employee deleted' });
});

module.exports = { list, getOne, create, update, remove };

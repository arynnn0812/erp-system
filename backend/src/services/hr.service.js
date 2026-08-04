// HR business logic. Notable: salary changes are audited with old/new values.
const departmentModel = require('../models/department.model');
const employeeModel = require('../models/employee.model');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');

// ---------- departments ----------

async function createDepartment(name) {
  const existing = await departmentModel.findByName(name);
  if (existing) throw new ApiError(409, 'Department already exists');
  return departmentModel.create(name);
}

async function updateDepartment(id, name) {
  const ok = await departmentModel.update(id, name);
  if (!ok) throw new ApiError(404, 'Department not found');
}

async function deleteDepartment(id) {
  try {
    const ok = await departmentModel.remove(id);
    if (!ok) throw new ApiError(404, 'Department not found');
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new ApiError(409, 'Cannot delete: department still has employees');
    }
    throw err;
  }
}

// ---------- employees ----------

async function createEmployee(data, actor, ip) {
  const dupe = await employeeModel.findByEmail(data.email);
  if (dupe) throw new ApiError(409, 'Employee email already exists');

  const dept = await departmentModel.findById(data.departmentId);
  if (!dept) throw new ApiError(400, 'Invalid departmentId');

  const id = await employeeModel.create(data);
  await audit({
    userId: actor.id, action: 'EMPLOYEE_CREATE', entity: 'employees', entityId: id,
    details: { name: data.name, department: dept.name }, ip,
  });
  return id;
}

async function updateEmployee(id, data, actor, ip) {
  const existing = await employeeModel.findRaw(id);
  if (!existing) throw new ApiError(404, 'Employee not found');

  const dept = await departmentModel.findById(data.departmentId);
  if (!dept) throw new ApiError(400, 'Invalid departmentId');

  await employeeModel.update(id, data);

  // Salary changes are sensitive - always audited with the diff.
  if (Number(existing.salary) !== Number(data.salary)) {
    await audit({
      userId: actor.id, action: 'SALARY_CHANGE', entity: 'employees', entityId: Number(id),
      details: { from: Number(existing.salary), to: Number(data.salary) }, ip,
    });
  }
}

async function deleteEmployee(id, actor, ip) {
  const ok = await employeeModel.remove(id);
  if (!ok) throw new ApiError(404, 'Employee not found');
  await audit({ userId: actor.id, action: 'EMPLOYEE_DELETE', entity: 'employees', entityId: Number(id), ip });
}

module.exports = {
  createDepartment, updateDepartment, deleteDepartment,
  createEmployee, updateEmployee, deleteEmployee,
};

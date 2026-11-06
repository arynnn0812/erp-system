// HR business logic. Notable: salary changes are audited with old/new values.
const departmentModel = require('../models/department.model');
const employeeModel = require('../models/employee.model');
const userModel = require('../models/user.model');
const documentModel = require('../models/document.model');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');

// ---------- departments ----------

async function createDepartment(name) {
  const existing = await departmentModel.findByName(name);
  if (existing) throw new ApiError(409, 'Department already exists');
  return departmentModel.create(name);
}

async function updateDepartment(id, name) {
  const existing = await departmentModel.findByName(name);
  if (existing && existing.id !== Number(id)) throw new ApiError(409, 'Department already exists');
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

// An employee may be linked to at most one login, and a login to at most one
// employee - that link is what lets an EMPLOYEE read their own documents.
// A linked login sees the record's salary (My profile) and can read its
// documents, so only ADMIN may set or change the link. Leaving userId out, or
// sending the current value, is not a change (the HR edit form omits it).
function assertMayLink(userId, actor, current = null) {
  if (userId === undefined || actor.role === 'ADMIN') return;
  if ((userId ?? null) === current) return;
  throw new ApiError(403, 'Only ADMIN can link an employee record to a login');
}

async function assertLinkableUser(userId, employeeId = null) {
  if (userId === null || userId === undefined) return;
  const user = await userModel.findById(userId);
  if (!user) throw new ApiError(400, `Invalid userId: ${userId}`);
  const linked = await employeeModel.findByUserId(userId);
  if (linked && linked.id !== Number(employeeId)) {
    throw new ApiError(409, 'That login is already linked to another employee');
  }
}

async function createEmployee(data, actor, ip) {
  const dupe = await employeeModel.findByEmail(data.email);
  if (dupe) throw new ApiError(409, 'Employee email already exists');

  const dept = await departmentModel.findById(data.departmentId);
  if (!dept) throw new ApiError(400, 'Invalid departmentId');
  assertMayLink(data.userId, actor);
  await assertLinkableUser(data.userId);

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

  const dupe = await employeeModel.findByEmail(data.email);
  if (dupe && dupe.id !== Number(id)) throw new ApiError(409, 'Employee email already exists');

  const dept = await departmentModel.findById(data.departmentId);
  if (!dept) throw new ApiError(400, 'Invalid departmentId');

  assertMayLink(data.userId, actor, existing.user_id);
  // userId omitted (e.g. the HR edit form) keeps the current link.
  const userId = data.userId === undefined ? existing.user_id : data.userId;
  await assertLinkableUser(userId, id);

  await employeeModel.update(id, { ...data, userId });

  // Salary changes are sensitive - always audited with the diff.
  if (Number(existing.salary) !== Number(data.salary)) {
    await audit({
      userId: actor.id, action: 'SALARY_CHANGE', entity: 'employees', entityId: Number(id),
      details: { from: Number(existing.salary), to: Number(data.salary) }, ip,
    });
  }
}

async function deleteEmployee(id, actor, ip) {
  // documents.owner_id has no foreign key (it is polymorphic), so the database
  // would happily orphan this employee's files. Make the caller decide first.
  const docs = await documentModel.countByOwner('EMPLOYEE', id);
  if (docs > 0) {
    throw new ApiError(409, `Employee has ${docs} document(s); delete them before deleting the employee`);
  }
  const ok = await employeeModel.remove(id);
  if (!ok) throw new ApiError(404, 'Employee not found');
  await audit({ userId: actor.id, action: 'EMPLOYEE_DELETE', entity: 'employees', entityId: Number(id), ip });
}

module.exports = {
  createDepartment, updateDepartment, deleteDepartment,
  createEmployee, updateEmployee, deleteEmployee,
};

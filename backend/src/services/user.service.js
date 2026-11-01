// Account administration (ADMIN only). Every change revokes the target's
// existing sessions via token_version, so it takes effect immediately.
const userModel = require('../models/user.model');
const { hashPassword } = require('./auth.service');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');

// An admin may not demote or deactivate themselves. Because only an admin can
// change accounts, this also guarantees at least one active admin remains.
async function updateAccess(targetId, { role, isActive }, actor, ip) {
  const target = await userModel.findById(targetId);
  if (!target) throw new ApiError(404, 'User not found');
  if (target.id === actor.id && ((role && role !== target.role) || isActive === false)) {
    throw new ApiError(409, 'You cannot change the role or status of your own account');
  }

  await userModel.updateAccess(targetId, { roleName: role, isActive });
  await audit({
    userId: actor.id, action: 'USER_ACCESS_CHANGE', entity: 'users', entityId: target.id,
    details: {
      ...(role && { role: { from: target.role, to: role } }),
      ...(isActive !== undefined && { isActive: { from: Boolean(target.is_active), to: isActive } }),
    },
    ip,
  });
  return userModel.findById(targetId);
}

// No email delivery in this system, so an admin sets a temporary password and
// shares it out of band; the user should change it after signing in.
async function resetPassword(targetId, newPassword, actor, ip) {
  const target = await userModel.findById(targetId);
  if (!target) throw new ApiError(404, 'User not found');
  await userModel.updatePassword(targetId, await hashPassword(newPassword));
  await audit({ userId: actor.id, action: 'PASSWORD_RESET', entity: 'users', entityId: target.id, ip });
}

module.exports = { updateAccess, resetPassword };

// Business logic for authentication. No req/res here - this layer is
// framework-independent and unit-testable.
// bcryptjs: pure-JS implementation of the bcrypt algorithm. Same API and
// same hashes as native bcrypt, but no node-gyp compile step - installs
// reliably on any EC2 AMI / Windows dev machine.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userModel = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');

const SALT_ROUNDS = 10; // 2^10 hashing iterations: ~100ms - slow enough to
                        // kill brute force, fast enough for login UX

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

// Compared against when the email is unknown, so "no such user" costs the same
// ~100ms as "wrong password" - response timing must not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', SALT_ROUNDS);

// Payload stays minimal: id + role + token version. Never put sensitive data
// in a JWT - it is signed (tamper-proof) but NOT encrypted (anyone can read it).
// tv ties the token to users.token_version so it can be revoked server-side.
function issueToken(user) {
  const token = jwt.sign(
    { id: user.id, role: user.role, tv: user.token_version },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn, algorithm: 'HS256' }
  );
  return { token, expiresAt: new Date(jwt.decode(token).exp * 1000) };
}

async function register({ name, email, password, role }, actor, ip) {
  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new ApiError(409, 'Email already registered'); // 409 Conflict
  }

  // bcrypt generates a random salt per password and embeds it in the hash,
  // so two users with the same password get different hashes.
  const passwordHash = await hashPassword(password);

  const id = await userModel.create({ name, email, passwordHash, roleName: role });
  if (actor) {
    await audit({ userId: actor.id, action: 'USER_CREATE', entity: 'users', entityId: id, details: { email, role }, ip });
  }
  return { id, name, email, role };
}

async function login({ email, password }, ip) {
  const user = await userModel.findByEmail(email);

  // Same error for "no such user" and "wrong password" - never tell an
  // attacker which emails exist (user enumeration).
  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  const match = Boolean(user && user.is_active && passwordOk);
  if (!match) {
    await audit({ userId: user?.id, action: 'LOGIN_FAILED', entity: 'users', details: { email }, ip });
    throw new ApiError(401, 'Invalid email or password');
  }

  await audit({ userId: user.id, action: 'LOGIN', entity: 'users', entityId: user.id, ip });
  const { token, expiresAt } = issueToken(user);
  return {
    token,
    expiresAt,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

// Requires the current password (a stolen session alone cannot lock the owner
// out), then revokes every other session and hands back a fresh token.
async function changePassword(userId, { currentPassword, newPassword }, ip) {
  const hash = await userModel.findPasswordHash(userId);
  if (!hash || !(await bcrypt.compare(currentPassword, hash))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  if (await bcrypt.compare(newPassword, hash)) {
    throw new ApiError(400, 'New password must be different from the current one');
  }
  await userModel.updatePassword(userId, await hashPassword(newPassword));
  await audit({ userId, action: 'PASSWORD_CHANGE', entity: 'users', entityId: userId, ip });

  return issueToken(await userModel.findAuthState(userId)); // carries the new version
}

async function logoutEverywhere(userId, ip) {
  await userModel.bumpTokenVersion(userId);
  await audit({ userId, action: 'LOGOUT_ALL', entity: 'users', entityId: userId, ip });
}

module.exports = { register, login, changePassword, logoutEverywhere, hashPassword };

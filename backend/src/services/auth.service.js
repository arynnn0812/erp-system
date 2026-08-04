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

const SALT_ROUNDS = 10; // 2^10 hashing iterations: ~100ms - slow enough to
                        // kill brute force, fast enough for login UX

async function register({ name, email, password, role }) {
  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new ApiError(409, 'Email already registered'); // 409 Conflict
  }

  // bcrypt generates a random salt per password and embeds it in the hash,
  // so two users with the same password get different hashes.
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const id = await userModel.create({ name, email, passwordHash, roleName: role });
  return { id, name, email, role };
}

async function login({ email, password }) {
  const user = await userModel.findByEmail(email);

  // Same error for "no such user" and "wrong password" - never tell an
  // attacker which emails exist (user enumeration).
  if (!user || !user.is_active) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Payload stays minimal: id + role. Never put sensitive data in a JWT -
  // it is signed (tamper-proof) but NOT encrypted (anyone can read it).
  const token = jwt.sign(
    { id: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

module.exports = { register, login };

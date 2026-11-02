// Loads .env once and exports typed, validated config values.
// Every other file imports from here instead of reading process.env directly,
// so all environment access is in one place and a bad value stops startup.
// The rules live in buildConfig.js, which is a pure function so tests can
// check them without touching process.env.
require('dotenv').config({ quiet: true });
const { buildConfig } = require('./buildConfig');

module.exports = buildConfig(process.env);

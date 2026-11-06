// docs/openapi.yaml must describe exactly the routes the API registers:
// adding, renaming or removing an endpoint without updating the spec fails
// here. The spec's layout is regular (two-space path keys, four-space method
// keys), so a line pattern reads it without a YAML dependency.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { describe, it, expect, afterAll } from 'vitest';
import { pool } from './helpers.js';

const require = createRequire(import.meta.url);
const app = require('../src/app');

afterAll(() => pool.end());

const SPEC = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function specOperations() {
  const ops = [];
  let current = null;
  for (const line of fs.readFileSync(SPEC, 'utf8').split('\n')) {
    const p = line.match(/^ {2}(\/api\/\S*):\s*$/);
    if (p) { current = p[1].replace(/\{(\w+)\}/g, ':$1'); continue; }
    if (/^\S/.test(line)) current = null; // left `paths:`
    const m = line.match(/^ {4}(\w+):\s*$/);
    if (current && m && METHODS.includes(m[1])) ops.push(`${m[1].toUpperCase()} ${current}`);
  }
  return ops;
}

// Express 4 keeps mounted routers as layers whose regexp encodes the prefix,
// e.g. /^\/api\/health\/?(?=\/|$)/i.
function appOperations() {
  const ops = [];
  for (const layer of app._router.stack) {
    if (layer.name !== 'router') continue;
    const prefix = layer.regexp.source
      .replace('^\\', '')
      .replace('\\/?(?=\\/|$)', '')
      .replace(/\\\//g, '/');
    for (const { route } of layer.handle.stack) {
      if (!route) continue;
      const full = prefix + (route.path === '/' ? '' : route.path);
      for (const method of Object.keys(route.methods)) ops.push(`${method.toUpperCase()} ${full}`);
    }
  }
  return ops;
}

describe('OpenAPI spec', () => {
  it('lists every registered route, and nothing else', () => {
    const spec = specOperations().sort();
    const routes = appOperations().sort();
    expect(routes.length).toBeGreaterThan(50); // the route walk itself works
    expect(spec.filter((op) => !routes.includes(op)), 'in the spec but not the API').toEqual([]);
    expect(routes.filter((op) => !spec.includes(op)), 'in the API but not the spec').toEqual([]);
    expect(new Set(spec).size, 'operations listed twice').toBe(spec.length);
  });
});

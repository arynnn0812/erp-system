#!/usr/bin/env node
// Builds docs/postman/erp-api.postman_collection.json from docs/openapi.yaml.
//
//   node scripts/build-postman.js
//
// openapi-to-postmanv2 (fetched by npx, not a project dependency) does the
// conversion; this script then makes the result usable straight away:
//   - placeholders such as "<integer>" in bodies and queries (fill them in),
//     not random sample values, so regenerating gives the same file;
//   - every request authenticates with {{token}} (Bearer), inherited from
//     the collection, except the public ones (login, logout, health);
//   - "Sign in" posts {{email}} / {{password}} and saves the returned token;
//   - one copy of each request (an operation tagged twice appeared twice);
//   - generated response examples dropped (docs/openapi.yaml has them),
//     which takes the file from ~750 KB to a size worth reviewing in a diff.
// Run it after changing the spec, and commit the result.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPEC = path.join(ROOT, 'docs', 'openapi.yaml');
const OUT = path.join(ROOT, 'docs', 'postman', 'erp-api.postman_collection.json');
const PUBLIC = new Set(['POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/health', 'GET /api/health/live', 'GET /api/health/ready']);

// The converter picks enum values with Math.random(); a seeded generator,
// preloaded into its process, makes the output the same on every run.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-postman-'));
const tmp = path.join(dir, 'raw.json');
const seed = path.join(dir, 'seed-random.js');
fs.writeFileSync(seed, 'let s = 42; Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;\n');
execFileSync('npx', [
  '--yes', 'openapi-to-postmanv2@5', '-s', SPEC, '-o', tmp,
  '-O', 'folderStrategy=Tags,parametersResolution=Schema',
], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, NODE_OPTIONS: `--require ${seed}` } });
const raw = JSON.parse(fs.readFileSync(tmp, 'utf8'));

const seen = new Set();
const opKey = (req) => `${req.method} /${req.url.path.join('/')}`;

function cleanRequest(item) {
  const key = opKey(item.request);
  if (seen.has(key)) return null;
  seen.add(key);

  const out = { name: item.name, request: { ...item.request } };
  // Path ids default to 1 (the first row the seed creates) instead of "<integer>".
  out.request.url = {
    ...item.request.url,
    variable: (item.request.url.variable || []).map((v) => ({ key: v.key, value: v.key === 'id' ? '1' : v.value })),
  };
  delete out.request.auth; // inherit the collection's Bearer {{token}}
  // Optional filters ship unticked (sending "search=<string>" fails validation);
  // report date ranges use the {{from}} / {{to}} collection variables.
  out.request.url.query = (item.request.url.query || []).map((q) => {
    if (q.value === '<date>') return { key: q.key, value: `{{${q.key}}}` };
    const required = /\(Required\)/.test(q.description?.content || '');
    if (required && q.value === '<integer>') return { key: q.key, value: '1' }; // an id, like the path ids
    return { key: q.key, value: q.value, disabled: !required && /^<.*>$/.test(q.value) };
  });
  if (PUBLIC.has(key)) out.request.auth = { type: 'noauth' };

  if (key === 'POST /api/auth/login') {
    out.request.body = {
      mode: 'raw',
      raw: '{\n  "email": "{{email}}",\n  "password": "{{password}}"\n}',
      options: { raw: { language: 'json' } },
    };
    out.event = [{
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          '// Saves the token so every other request is signed in.',
          'if (pm.response.code === 200) {',
          '  pm.collectionVariables.set("token", pm.response.json().data.token);',
          '}',
          'pm.test("signed in", () => pm.response.to.have.status(200));',
        ],
      },
    }];
  }
  return out;
}

function cleanFolder(folder) {
  const item = folder.item
    .map((i) => (i.item ? cleanFolder(i) : cleanRequest(i)))
    .filter(Boolean);
  return item.length ? { name: folder.name, description: folder.description, item } : null;
}

const collection = {
  info: {
    name: 'ERP System API',
    description: [
      'Generated from docs/openapi.yaml by scripts/build-postman.js.',
      '',
      '1. Import this collection and docs/postman/local.postman_environment.json, and pick the "ERP local" environment.',
      '2. Run Auth > "Sign in; sets the session cookie". It saves {{token}}.',
      '3. Every other request sends it as a Bearer token.',
      '',
      'Change {{email}} in the environment to try another role (admin@, manager@, hr@, employee@erp.com).',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'token', value: '' },
    { key: 'from', value: `${new Date().getFullYear()}-01-01` },
    { key: 'to', value: `${new Date().getFullYear()}-12-31` },
  ],
  item: raw.item.map((f) => (f.item ? cleanFolder(f) : cleanRequest(f))).filter(Boolean),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`wrote ${path.relative(ROOT, OUT)}: ${seen.size} requests`);

# API guide

The complete reference is [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1): every
endpoint, parameter, role and response shape. A test
(`backend/test/openapi.test.js`) fails if an endpoint is added or removed
without updating it. This page is the short version: how to sign in, the
conventions, and a map of the endpoints.

To browse the reference with a UI:

```bash
npx @redocly/cli preview-docs docs/openapi.yaml    # http://localhost:8080
```

or paste the file into https://editor.swagger.io.

**Postman.** Import `docs/postman/erp-api.postman_collection.json` and
`docs/postman/local.postman_environment.json`, then pick the "ERP local"
environment. Run Auth → "Sign in": it saves the token, and every other request
sends it. Change `email` in the environment to try another role. The
collection is generated from the spec; after changing the spec, run
`node scripts/build-postman.js`.

The examples below are real responses from the demo data
(`npm run seed:demo`), against the API on `http://localhost:4000`. Through
the Docker stack, use `http://localhost:8080` instead.

## Signing in

The browser app uses an httpOnly cookie. Scripts can use the same cookie or
the token from the response.

```bash
curl -c jar.txt -H 'Content-Type: application/json' \
  -d '{"email":"manager@erp.com","password":"Password@123"}' \
  http://localhost:4000/api/auth/login
```
```json
{"success":true,"data":{"token":"eyJhbGciOi…","expiresAt":"2026-11-07T07:52:52.000Z",
 "user":{"id":3,"name":"Manager User","email":"manager@erp.com","role":"MANAGER"}}}
```

The response sets `erp_session` (HttpOnly, SameSite=Strict, Path=/api,
Secure in production). Send it back with `-b jar.txt`:

```bash
curl -b jar.txt 'http://localhost:4000/api/products?search=mouse&limit=2'
```
```json
{"success":true,"rows":[{"id":6,"name":"Wireless Mouse","sku":"ACC-MOUSE","price":"899.00",
 "quantity":14,"reorder_level":20,"supplier":"Logitech","category_id":3,
 "category":"Accessories","low_stock":1}],"total":1,"page":1,"pages":1}
```

Or use the token as a bearer token:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/auth/me
```

A session lasts `JWT_EXPIRES_IN` (default one day). It ends early, on every
device, when the user signs out everywhere, changes their password, has it
reset, is deactivated, or has their role changed. Each of these bumps a
per-user `token_version` that every request checks.

## Conventions

| | |
|---|---|
| Envelope | Every body has `success: true` or `false`. |
| Lists | Paged lists return `rows`, `total`, `page`, `pages` (`?page=2&limit=25`, limit at most 100). Short lists return `data`. |
| Money | Decimal **strings**, such as `"899.00"`. They are MySQL `DECIMAL` values passed through unchanged, so no floating-point rounding ever touches a stored amount. |
| Dates | Query dates are `YYYY-MM-DD`, and date ranges include both ends. Timestamps are ISO 8601 in UTC. |
| Request IDs | Every response has an `X-Request-Id` header. 500 responses repeat it in the body as `requestId`, so a report can be matched to the server log. |
| Rate limits | 300 requests/minute per IP across the API, plus 10 failed sign-ins per 15 minutes per IP. Over the limit, responses are `429`, with `RateLimit` and `RateLimit-Policy` headers. Health checks are exempt. |

## Errors

| Status | Meaning | Example `message` |
|---|---|---|
| 400 | Invalid input. `errors` lists each failing field. | `Validation failed` |
| 401 | No session, or the session was ended | `Authentication required` |
| 403 | Your role may not do this | `Forbidden: insufficient role` |
| 404 | No such record | `Order not found` |
| 409 | Conflicts with existing data | `Cannot delete: category still has products` |
| 413 / 415 | File over 5 MB / file content does not match its type | |
| 422 | Valid input that breaks a business rule | `Insufficient stock for Dell Latitude 3450: have 9, requested 100000` |
| 429 | Rate limited | `Too many login attempts, try again in 15 minutes` |
| 503 | A dependency is unavailable (S3 not configured, database down) | |

```json
{"success":false,"message":"Validation failed",
 "errors":[{"field":"items","message":"items must be a non-empty array"}]}
```

With `NODE_ENV=development`, error bodies also carry a `stack` field.
Production never includes it, and its 500 responses say only `Internal server error`.

## Roles

| | ADMIN | HR | MANAGER | EMPLOYEE |
|---|:-:|:-:|:-:|:-:|
| Products, categories, customers: read | ✓ | ✓ | ✓ | ✓ |
| Products, categories, customers: write; stock movements | ✓ | | ✓ | |
| Orders, sales reports, CSV export, reorder planner | ✓ | | ✓ | |
| Employees: read | ✓ | ✓ | ✓ (no salary) | |
| Employees, departments: write | ✓ | ✓ | | |
| Link an employee record to a login | ✓ | | | |
| Employee documents | ✓ | ✓ | | own only |
| Product documents: upload / delete | ✓ | | ✓ | |
| Users and access, audit log | ✓ | | | |
| Own profile, password, sign out everywhere | ✓ | ✓ | ✓ | ✓ |

Deleting things (products, categories, departments, employees) is ADMIN only.
Salary is left out of the SQL for MANAGER rather than removed afterwards, so it
cannot leak through a forgotten code path.

## Examples

**Create an order.** Stock is checked and taken, and the order written, in one
transaction:

```bash
curl -b jar.txt -H 'Content-Type: application/json' \
  -d '{"customerId":1,"items":[{"productId":2,"quantity":3}],"taxPercent":18}' \
  http://localhost:4000/api/orders
```
```json
{"success":true,"data":{"orderId":139,"subtotal":175497,"tax":31589.46,"discount":0,
 "grandTotal":207086.46,"items":[{"productId":2,"quantity":3,"unitPrice":58499,"lineTotal":175497}]}}
```

**Not enough stock.** Nothing is written:

```json
{"success":false,"message":"Insufficient stock for Dell Latitude 3450: have 9, requested 100000"}
```

**Reorder plan.** This covers 30 days of sales, sizes the purchase to cover 30
days, and assumes a supplier lead time of 7 days:

```bash
curl -b jar.txt 'http://localhost:4000/api/products/insights/reorder?days=30&cover=30&leadTime=7'
```
```json
{"success":true,"params":{"days":30,"cover":30,"leadTime":7},"data":[
 {"id":13,"name":"Cat6 Patch Cable (pack of 10)","sku":"NET-CAT6","quantity":0,"reorder_level":10,
  "supplier":"D-Link","price":"1299.00","category":"Networking","units_sold":21,
  "daily_velocity":0.7,"days_of_stock":0,"suggested_qty":31,"status":"OUT"}, …]}
```

Here 21 units sold in 30 days is 0.7 a day. Covering 30 days takes 21 units,
plus 10 for the reorder level, minus 0 on hand, which gives an order of 31.

**Export a month of orders as CSV:**

```bash
curl -b jar.txt -o orders.csv \
  'http://localhost:4000/api/orders/reports/export?from=2026-10-01&to=2026-10-31'
```
```
Order #,Date,Status,Customer,Created by,Units,Subtotal,Tax,Discount,Total
97,2026-10-02,CONFIRMED,Ganga Textiles,Manager User,3,23997.00,4319.46,0.00,28316.46
```

The file is UTF-8 with a byte-order mark, so Excel shows non-English names
correctly. A cell that would start with `= + - @` gets a leading `'`, so a
customer called `=HYPERLINK(…)` stays text instead of becoming a formula.

## Endpoints

Roles are in brackets. "signed in" means any role.

**Health** (no sign-in):
`GET /api/health/live` · `GET /api/health/ready` · `GET /api/health`

**Auth**

| | |
|---|---|
| `POST /api/auth/login` · `POST /api/auth/logout` | |
| `GET /api/auth/me` · `GET /api/auth/profile` | signed in |
| `POST /api/auth/change-password` · `POST /api/auth/logout-all` | signed in |
| `POST /api/auth/register` | ADMIN |

**Users** (ADMIN): `GET /api/users` · `PATCH /api/users/{id}` (role, isActive) · `POST /api/users/{id}/reset-password`

**Inventory**

| | |
|---|---|
| `GET /api/categories` · `GET /api/products` · `GET /api/products/{id}` · `GET /api/products/{id}/transactions` · `GET /api/products/alerts/low-stock` | signed in |
| `POST`/`PUT /api/categories…` · `POST`/`PUT /api/products…` · `POST /api/products/{id}/stock` | ADMIN, MANAGER |
| `GET /api/products/insights/reorder` | ADMIN, MANAGER |
| `DELETE /api/categories/{id}` · `DELETE /api/products/{id}` (deactivates) | ADMIN |

**Sales**

| | |
|---|---|
| `GET /api/customers` · `GET /api/customers/{id}` | signed in |
| `POST`/`PUT /api/customers…` | ADMIN, MANAGER |
| `GET /api/orders` · `GET /api/orders/{id}` · `POST /api/orders` · `POST /api/orders/{id}/cancel` | ADMIN, MANAGER |
| `GET /api/orders/reports/summary`, `/top-products`, `/daily`, `/export` (from, to; at most 366 days) | ADMIN, MANAGER |

**HR**

| | |
|---|---|
| `GET /api/departments` | signed in |
| `GET /api/employees` · `GET /api/employees/{id}` | ADMIN, HR, MANAGER (salary for ADMIN and HR) |
| `POST`/`PUT /api/departments…` · `POST`/`PUT /api/employees…` | ADMIN, HR |
| `DELETE /api/departments/{id}` · `DELETE /api/employees/{id}` | ADMIN |

**Dashboard**: `GET /api/dashboard/summary` (signed in; the fields depend on the role) ·
`GET /api/dashboard/sales-trend`, `/category-sales`, `/top-products` (ADMIN, MANAGER)

**Live updates**: `GET /api/dashboard/stream` (signed in) is a Server-Sent
Events stream. It sends `event: change` with `data: {"topic":"dashboard"}`
within about half a second of any successful write to products, categories,
customers, orders or employees, and a `: ping` comment every 25 seconds. The
event carries no figures; refetch the endpoints above. Try it with
`curl -N -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/dashboard/stream`.

**Documents** (S3; 503 until storage is configured): `GET /api/documents?ownerType=&ownerId=` ·
`POST /api/documents` (multipart: file, ownerType, ownerId) · `GET /api/documents/{id}/url`
(link valid 5 minutes) · `DELETE /api/documents/{id}`. Access depends on the
owner; see Roles above.

**Audit** (ADMIN): `GET /api/audit-logs` (action, entity, userId, from, to) · `GET /api/audit-logs/actions`

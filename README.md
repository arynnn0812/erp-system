# Cloud-Based ERP System

A production-style ERP for small/medium businesses: **inventory, sales/finance, and HR** in one system, with role-based access control for Admin, HR, Manager, and Employee, a role-aware analytics dashboard, and AWS S3 document storage.

**Stack:** React · Node.js/Express · MySQL · JWT · AWS EC2 + S3

---

## Features

- **Authentication & RBAC** — JWT in an `httpOnly`, `SameSite=Strict` cookie (Bearer header also accepted for API clients), bcrypt hashing, four roles enforced at route level, at SQL level (salary), and at object level (whether *this* user may read *this* row). Sessions are revocable: every request re-checks the user, so deactivation, role changes, password changes and "log out everywhere" apply immediately (`token_version`). Password policy (10+ chars, letter + digit, ≤72 bytes for bcrypt), failed-login rate limiting, admin account management with self-lockout protection.
- **Inventory** — product/category CRUD, transactional stock in/out with `SELECT ... FOR UPDATE` row locking, append-only transaction ledger, low-stock alerts, search + pagination, soft delete.
- **Sales/Finance** — customers, multi-item invoices with server-side totals (tax/discount), **atomic order confirmation** (order + items + stock deduction + ledger commit or roll back together), deadlock-safe lock ordering, compensating cancel-with-restock, date-range revenue reports, top products.
- **HR** — departments and employees, HR/Admin-only management, field-level access (managers never receive salary data), audited salary changes.
- **Dashboard** — role-aware summary counters, monthly sales trend, category-wise sales, top sellers; all aggregation in SQL.
- **Documents** — uploads to a private S3 bucket (5MB cap, type verified from the file's magic bytes, not just the client's claim), metadata in MySQL, 5-minute presigned download URLs, S3 cleanup when the database write fails, delete endpoint. Employee documents are readable only by ADMIN, HR, or the employee themselves; product documents by any authenticated user. Every presigned URL issued is audited.
- **Cross-cutting** — centralized error handling (constraint violations mapped to 409/400), express-validator validation and sanitization, parameterized queries everywhere, Helmet + locked-down CORS, API-wide rate limit, structured JSON logging (pino) with request IDs and secret redaction, graceful shutdown, append-only audit log (including logins and failed logins), health check with DB ping.

## Architecture

```
React SPA ──JSON/HTTPS──> Express API ──SQL pool──> MySQL (InnoDB)
                              │
                              └────────> AWS S3 (private bucket, presigned GETs)
```

3-tier, stateless API (JWT carries identity → horizontally scalable). Layered backend: `routes → middleware (auth, rbac, validation) → controllers → services → models`.

## Getting started

Prerequisites: Node 18+, MySQL 8.

```bash
git clone https://github.com/arynnn0812/erp-system.git && cd erp-system

# backend
cd backend
npm install
cp .env.example .env        # fill in DB credentials and JWT secret; AWS optional
npm run migrate             # creates the database and applies database/migrations/*.sql
npm run seed                # demo users for all 4 roles (password: Password@123)
npm run dev                 # http://localhost:4000 (restarts on file changes)

# frontend (second terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173, proxies /api to the backend
```

`npm run migrate` is safe to re-run: applied migrations are recorded in
`schema_migrations`. A database created from the old `schema.sql` is detected
and baselined automatically. Schema changes go in a new numbered file in
`database/migrations/`; never edit one that has been applied.

Health check: `GET http://localhost:4000/api/health`

Demo accounts: `admin@erp.com`, `hr@erp.com`, `manager@erp.com`, `employee@erp.com`.

## Environment variables

See `backend/.env.example`. Required: `DB_HOST`, `DB_USER`, `DB_NAME`, `JWT_SECRET`. Optional: `AWS_REGION` + `S3_BUCKET_NAME` (document endpoints return 503 with a clear message when unset). On EC2, prefer an IAM instance role over access keys.

`.env` is intentionally **not** committed or shipped — copy `.env.example` and fill it in per environment.

**`TRUST_PROXY`** — set to `1` whenever the API runs behind nginx or a load balancer. Left at `0`, Express reports the proxy's address as `req.ip`, which collapses the login rate limiter into a single shared bucket for all users and writes the proxy IP into every audit log row.

## API overview (40+ endpoints)

| Area | Base path | Highlights |
|---|---|---|
| Auth | `/api/auth` | login (rate-limited), register (admin-only), me, logout, logout-all, change-password |
| Users | `/api/users` | list, change role / activate / deactivate, reset password (admin) |
| Categories | `/api/categories` | CRUD, FK-protected delete |
| Products | `/api/products` | CRUD, search/filter/pagination, `/:id/stock`, `/:id/transactions`, `/alerts/low-stock` |
| Customers | `/api/customers` | CRUD + search |
| Orders | `/api/orders` | ADMIN/MANAGER only; create (atomic), cancel (restock), `/reports/summary`, `/reports/top-products` |
| Departments | `/api/departments` | CRUD (HR/Admin) |
| Employees | `/api/employees` | CRUD (HR/Admin), field-level salary visibility |
| Dashboard | `/api/dashboard` | summary, sales-trend, category-sales, top-products |
| Documents | `/api/documents` | S3 upload, metadata list, presigned download URL (owner-scoped), delete |

Full request/response examples and per-phase Postman test suites: `PHASE-1-GUIDE.md` … `PHASE-6-GUIDE.md`.

## Testing

Backend integration tests (Vitest + Supertest) run against a real MySQL, because
transactions and row locking are what they need to prove. They create and drop
their own `erp_test` database.

```bash
cd backend
DB_PASSWORD=yourpassword npm test     # DB_HOST/DB_PORT/DB_USER default to 127.0.0.1:3306/root
npm run lint
```

Covered: login and role enforcement, field-level salary hiding, atomic order
creation and rollback, concurrent stock-outs (no oversell), cancel-and-restock,
constraint errors mapped to 409/400, validation of query parameters, and
regression tests for each bug fixed in the audit (see `docs/ROADMAP.md`).

## Screenshots

*(placeholders — add after frontend build)*

- Login · Dashboard (admin) · Inventory list with low-stock badges · Order creation · Employee management (HR view vs Manager view)

## Deployment

Summarized in `DEPLOYMENT-GUIDE.md`: Ubuntu EC2, Node via nvm, MySQL (RDS or local), pm2 process manager, nginx reverse proxy, environment variables via systemd/pm2 ecosystem file, S3 bucket with least-privilege IAM role.

## Project structure

```
erp-system/
├── database/schema.sql        # 12 tables, FKs, CHECKs, indexes, seed roles
├── backend/
│   ├── scripts/seed.js
│   └── src/
│       ├── app.js  server.js
│       ├── config/     env.js  db.js  s3.js
│       ├── middleware/ auth  roles  validate  upload  errorHandler
│       ├── validators/ controllers/  services/  models/  routes/  utils/
└── frontend/                  # React SPA (see FRONTEND-ARCHITECTURE.md)
```

# Cloud-Based ERP System

A production-style ERP for small/medium businesses: **inventory, sales/finance, and HR** in one system, with role-based access control for Admin, HR, Manager, and Employee, a role-aware analytics dashboard, and AWS S3 document storage.

**Stack:** React · Node.js/Express · MySQL · JWT · AWS EC2 + S3

---

## Features

- **Authentication & RBAC** — JWT auth, bcrypt password hashing, four roles enforced at route level, at SQL level (sensitive fields like salary), and at object level (whether *this* user may read *this* row). Login rate limiting, admin-only registration.
- **Inventory** — product/category CRUD, transactional stock in/out with `SELECT ... FOR UPDATE` row locking, append-only transaction ledger, low-stock alerts, search + pagination, soft delete.
- **Sales/Finance** — customers, multi-item invoices with server-side totals (tax/discount), **atomic order confirmation** (order + items + stock deduction + ledger commit or roll back together), deadlock-safe lock ordering, compensating cancel-with-restock, date-range revenue reports, top products.
- **HR** — departments and employees, HR/Admin-only management, field-level access (managers never receive salary data), audited salary changes.
- **Dashboard** — role-aware summary counters, monthly sales trend, category-wise sales, top sellers; all aggregation in SQL.
- **Documents** — uploads to a private S3 bucket (5MB cap, mime whitelist, memory storage), metadata in MySQL, 5-minute presigned download URLs. Employee documents are readable only by ADMIN, HR, or the employee themselves; product documents by any authenticated user. Every presigned URL issued is audited.
- **Cross-cutting** — centralized error handling, express-validator input validation, parameterized queries everywhere, Helmet + locked-down CORS, append-only audit log, health check with DB ping.

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
git clone <repo> && cd erp-system

# database
mysql -u root -p < database/schema.sql

# backend
cd backend
npm install
cp .env.example .env        # fill in DB password, JWT secret; AWS optional
node scripts/seed.js        # demo users for all 4 roles (password: Password@123)
npm run dev                 # http://localhost:5000
```

Health check: `GET http://localhost:5000/api/health`

Demo accounts: `admin@erp.com`, `hr@erp.com`, `manager@erp.com`, `employee@erp.com`.

## Environment variables

See `backend/.env.example`. Required: `DB_HOST`, `DB_USER`, `DB_NAME`, `JWT_SECRET`. Optional: `AWS_REGION` + `S3_BUCKET_NAME` (document endpoints return 503 with a clear message when unset). On EC2, prefer an IAM instance role over access keys.

`.env` is intentionally **not** committed or shipped — copy `.env.example` and fill it in per environment.

**`TRUST_PROXY`** — set to `1` whenever the API runs behind nginx or a load balancer. Left at `0`, Express reports the proxy's address as `req.ip`, which collapses the login rate limiter into a single shared bucket for all users and writes the proxy IP into every audit log row.

## API overview (40+ endpoints)

| Area | Base path | Highlights |
|---|---|---|
| Auth | `/api/auth` | login (rate-limited), register (admin-only), me, logout |
| Users | `/api/users` | list (admin) |
| Categories | `/api/categories` | CRUD, FK-protected delete |
| Products | `/api/products` | CRUD, search/filter/pagination, `/:id/stock`, `/:id/transactions`, `/alerts/low-stock` |
| Customers | `/api/customers` | CRUD + search |
| Orders | `/api/orders` | ADMIN/MANAGER only; create (atomic), cancel (restock), `/reports/summary`, `/reports/top-products` |
| Departments | `/api/departments` | CRUD (HR/Admin) |
| Employees | `/api/employees` | CRUD (HR/Admin), field-level salary visibility |
| Dashboard | `/api/dashboard` | summary, sales-trend, category-sales, top-products |
| Documents | `/api/documents` | S3 upload, metadata list, presigned download URL (owner-scoped) |

Full request/response examples and per-phase Postman test suites: `PHASE-1-GUIDE.md` … `PHASE-6-GUIDE.md`.

## Testing

Each phase guide ends with a Postman suite covering the happy path, auth failures (401/403), validation errors (400), business-rule rejections (409/422), and the atomicity/concurrency cases (mixed-order rollback, oversell prevention, rate limiting).

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

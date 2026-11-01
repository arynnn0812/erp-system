# Improvement Roadmap

Ordered by value: first make what exists **correct**, then **safe**, then
**complete**, then **pleasant**, then **shippable**. Each phase ends with the
test suite green and both apps building.

Guiding rules: keep the existing architecture (it is sound), add a dependency
only when it replaces real hand-written risk, and never claim a feature,
test result or metric that has not been run.

## Phase 0 — Foundation
Groundwork every later phase depends on.
- Repo hygiene: root `.gitignore`, remove committed `.DS_Store`.
- Upgrade vulnerable dependencies (`npm audit`: 7 backend, 8 frontend; `multer` 1.x → 2.x).
- Versioned SQL migrations + tiny runner (`npm run migrate`) replacing the
  non-re-runnable `schema.sql`.
- Test harness: Vitest + Supertest integration tests against a real MySQL.
- ESLint for backend and frontend.

## Phase 1 — Correctness (audit bugs B1–B11)
Each fix lands with a regression test.
- Dates shift a day (mysql2 `DATE` → JS `Date`): `dateStrings: true`.
- Category revenue counts cancelled orders: fix the join.
- Order line merge string-concatenates quantities: sanitize with `.toInt()`/`.toFloat()`.
- Duplicate/foreign-key violations return 500: map to 409/400, add update checks.
- `PUT /products/:id` without `reorderLevel` → 500.
- Unvalidated query params on customers/dashboard → 500.
- Employee `userId` ignored on update.
- Product creation + opening stock not atomic.
- Frontend: stuck dashboard loader, pie color mismatch, order quantity 0.

## Phase 2 — Security & reliability
- Per-request user check: deactivated users and role changes take effect
  immediately; `token_version` enables real logout / revoke-all-sessions.
- JWT in an `httpOnly`, `SameSite=Strict` cookie (Bearer kept for API clients).
- Password policy, change-password endpoint.
- Global API rate limit in addition to the login limiter.
- Uploads: verify file type from magic bytes, clean up S3 on DB failure, delete endpoint.
- Structured logging (pino) with request IDs, graceful shutdown.

## Phase 3 — Missing & advanced features
Backend endpoints that already exist get a UI; a few high-value additions.
- Categories management (currently blocks creating products on a fresh install).
- User management (create, change role, deactivate) for ADMIN.
- Order detail + printable invoice; order filters; date-range sales report with CSV export.
- Product stock history and low-stock alerts page.
- Documents UI on employee and product pages.
- Audit log viewer (ADMIN).
- **Reorder intelligence**: per-product sales velocity, days-of-stock-left and
  a suggested reorder quantity, computed in SQL from real order history.
- Employee self-service: "My profile" and own documents for the EMPLOYEE role.
- Realistic demo seed data so the dashboard is meaningful out of the box.

## Phase 4 — UI/UX redesign
- Design tokens (color, type scale, spacing, radius, elevation) with light + dark themes.
- App shell: collapsible sidebar, top bar, mobile drawer.
- Shared components: Button, Input/Field (labelled), Select, Modal (Esc, focus
  trap, `role="dialog"`), ConfirmDialog, Toasts, Skeletons, EmptyState, Badge.
- Responsive tables (card layout on mobile), debounced search, loading/error states, 404 page.
- Subtle motion respecting `prefers-reduced-motion`.

## Phase 5 — Production readiness
- Dockerfiles (API, frontend via nginx) + `docker-compose.yml` (MySQL, API, web).
- GitHub Actions CI: lint, test against a MySQL service, build.
- Health (liveness) vs readiness endpoints; env validation at startup.
- Deployment guide (EC2 / any VM, nginx, pm2 or Docker), secrets guidance.

## Phase 6 — Documentation & presentation
- README rewrite: overview, architecture diagram, feature tour, stack rationale, setup.
- `docs/ARCHITECTURE.md`, `docs/API.md` (OpenAPI spec), `docs/DEPLOYMENT.md`.
- Real screenshots captured from the running app.

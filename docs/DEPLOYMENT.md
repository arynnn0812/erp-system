# Deployment guide

Two supported ways to run the ERP in production:

| | **A. Docker Compose** (recommended) | **B. Without Docker** |
|---|---|---|
| Runs | MySQL, API and nginx as containers on one machine | Node + nginx + MySQL (or RDS) installed on a VM |
| Migrations | Automatic on every `up` | `npm run migrate` on each release |
| Tested here | Yes: build, start, seed, smoke test, outage recovery, graceful stop, backup/restore | Uses the same config and files; the systemd unit and VM nginx steps were not run in this repo's checks |

Both end up with the same shape:

```
browser ──HTTPS──> TLS proxy ──> nginx :8080 ──/api──> Node API :4000 ──> MySQL
                   (Caddy, host    │                       │
                    nginx or LB)   └── static SPA          └──> S3 (optional)
```

nginx serves the built React app and proxies `/api` on the same origin, so
there is no CORS in production and the `SameSite=Strict` session cookie works.

---

## A. Docker Compose

Needs Docker Engine 24+ with the Compose plugin (`docker compose version`).
A 1 vCPU / 2 GB VM is enough for a small team.

### 1. Configure

```bash
git clone https://github.com/arynnn0812/erp-system.git /opt/erp-system
cd /opt/erp-system
cp .env.example .env
chmod 600 .env
```

Fill in the three required values. Generate each one, don't invent them:

```bash
echo "MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)"
echo "DB_PASSWORD=$(openssl rand -hex 24)"
echo "JWT_SECRET=$(openssl rand -base64 48)"
```

Set `PUBLIC_URL` to the address people will use (for example
`https://erp.example.com`). Compose refuses to start while a required value is
missing, and the API refuses to start with an unsafe one (see
[Configuration checks](#configuration-checks)).

### 2. Start

```bash
docker compose up -d --build --wait
```

What happens, in order:

1. `db` starts MySQL 8.4 with a named volume (`db-data`) and becomes healthy.
2. `migrate` applies `database/migrations/*.sql` and exits. It is safe to run
   on every start: applied files are recorded in `schema_migrations`.
3. `api` starts once migrations succeed, and is healthy once it can reach MySQL.
4. `web` (nginx) starts once the API is healthy and listens on
   `127.0.0.1:8080`.

### 3. Create the first administrator

```bash
read -rs ADMIN_PASSWORD && export ADMIN_PASSWORD   # at least 10 characters, a letter and a number
docker compose run --rm -e ADMIN_NAME="Your Name" -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD \
  api node scripts/create-admin.js
```

The password is passed through the environment (not typed on the command
line), so it does not end up in shell history or `ps`. Everyone else is then
added from **Users & access** in the app.

> **Demo instead?** `docker compose run --rm api node scripts/seed.js --demo`
> creates four demo logins sharing the password `Password@123` and six months
> of sample data. Never run it on a server other people can reach.

### 4. Check it

```bash
SMOKE_EMAIL=you@example.com SMOKE_PASSWORD="$ADMIN_PASSWORD" scripts/smoke-test.sh http://localhost:8080
```

The script checks liveness, readiness (database), the app shell, the security
headers, deep-link fallback, that the API rejects anonymous calls, and sign-in.
It exits non-zero on the first failure, so it can gate a deploy.

### 5. Put HTTPS in front

The web container is bound to `127.0.0.1` on purpose: put a TLS proxy in front
of it. The simplest is [Caddy](https://caddyserver.com), which gets and
renews certificates automatically. `/etc/caddy/Caddyfile`:

```
erp.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Then, in `.env`:

```bash
PUBLIC_URL=https://erp.example.com
TRUST_PROXY=2          # Caddy + the web container's nginx
```

and apply it with `docker compose up -d`.

`TRUST_PROXY` must equal the number of proxies in front of the API: it is how
the API finds the real client IP for the login rate limiter and the audit log.
Too low and every user shares one rate-limit bucket. Too high and a client can
forge its IP with `X-Forwarded-For`. With a cloud load balancer instead of
Caddy, the count is the same: 2.

**Trying it over plain http on another machine?** Browsers drop `Secure`
cookies on `http://` (except on `localhost`), so sign-in would loop. For a
trial only, set `WEB_BIND=0.0.0.0` and `COOKIE_SECURE=false`. The API logs a
warning while that is set.

### Updating

```bash
cd /opt/erp-system
git pull
docker compose up -d --build --wait
scripts/smoke-test.sh http://localhost:8080
```

New migrations are applied before the new API starts. The API is briefly
unavailable while its container is replaced (a few seconds). Write migrations
so they work with both the old and the new code if that matters to you.

### Backups

MySQL lives in the `erp_db-data` volume. Back it up with a consistent dump
(`--single-transaction` does not lock the tables):

```bash
docker compose exec -T db sh -c \
  'exec mysqldump --single-transaction --routines --no-tablespaces -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  | gzip > "erp-$(date +%F).sql.gz"
```

Run it from cron and copy the file off the machine (for example to S3).
Restore into the running database:

```bash
gunzip -c erp-2026-11-02.sql.gz | docker compose exec -T db sh -c \
  'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
```

A backup you have never restored is not a backup: restore into a scratch
database now and then and compare row counts.

`docker compose down` keeps the data. **`docker compose down -v` deletes it.**

### Logs

```bash
docker compose logs -f api          # JSON lines, one per request
docker compose logs -f api | npx pino-pretty   # readable, on a machine with Node
```

Every API response carries an `X-Request-Id` header. nginx generates it, and
it appears on every log line for that request, so one failing call from a
user's browser can be found in the logs. Logs rotate at 10 MB × 5 files per
container.

### Secrets as files

Instead of putting a secret in `.env`, the API accepts `NAME_FILE=/path` for
`DB_PASSWORD`, `JWT_SECRET` and `AWS_SECRET_ACCESS_KEY`. It reads the file at
startup, which keeps the value out of `docker inspect`. This works with Docker
or Kubernetes secrets mounted into the container.

---

## B. Without Docker (Ubuntu VM)

### 1. Install

```bash
# Node 22 LTS (NodeSource), nginx, MySQL 8 (or use Amazon RDS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx mysql-server
sudo useradd --system --home /opt/erp-system --shell /usr/sbin/nologin erp
sudo git clone https://github.com/arynnn0812/erp-system.git /opt/erp-system
```

Create the database user (on RDS, with the master user):

```sql
CREATE DATABASE erp_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'erp'@'localhost' IDENTIFIED BY '<generated password>';
GRANT ALL PRIVILEGES ON erp_db.* TO 'erp'@'localhost';
```

### 2. Configure the API

```bash
sudo mkdir -p /etc/erp
sudo cp /opt/erp-system/backend/.env.example /etc/erp/api.env
sudo chmod 600 /etc/erp/api.env      # owned by root; systemd reads it
sudo nano /etc/erp/api.env           # NODE_ENV=production, DB_*, JWT_SECRET, TRUST_PROXY=1, CLIENT_URL
```

Keep comments on their own lines in this file: systemd does not strip a
trailing `# ...` from a value. The API's startup checks reject the resulting
value rather than silently using a default.

### 3. Build and migrate

```bash
cd /opt/erp-system/backend && sudo npm ci --omit=dev
cd /opt/erp-system/frontend && sudo npm ci && sudo npm run build
sudo mkdir -p /var/www/erp && sudo cp -r dist/. /var/www/erp/
```

One-off scripts need the API's environment. This helper loads `api.env` (as
root, the only user that can read it) and runs a backend script with it:

```bash
erp_run() {
  sudo --preserve-env=ADMIN_NAME,ADMIN_EMAIL,ADMIN_PASSWORD sh -c \
    'set -a && . /etc/erp/api.env && set +a && cd /opt/erp-system/backend && exec node "$@"' sh "$@"
}
erp_run scripts/migrate.js

read -rs ADMIN_PASSWORD && export ADMIN_PASSWORD
ADMIN_NAME="Your Name" ADMIN_EMAIL=you@example.com erp_run scripts/create-admin.js
```

### 4. Run the API with systemd

```bash
sudo cp /opt/erp-system/deploy/erp-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now erp-api
journalctl -u erp-api -f
```

The unit restarts the API on failure, sends `SIGTERM` for a graceful stop, and
runs it as the unprivileged `erp` user with a read-only view of the system.
(pm2 works too: `pm2 start src/server.js --name erp-api`. The unit needs no
extra tool.)

### 5. nginx

Reuse the container's config. It is the same file, with the upstream filled in
and the files served from `/var/www/erp`:

```bash
sed -e 's|${API_UPSTREAM}|127.0.0.1:4000|' \
    -e 's|/usr/share/nginx/html|/var/www/erp|' \
    -e 's|listen 8080;|listen 80;|' \
    /opt/erp-system/frontend/nginx/default.conf.template | sudo tee /etc/nginx/sites-available/erp
sudo ln -sf /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/erp
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d erp.example.com
```

Here nginx is the only proxy, so `TRUST_PROXY=1`.

### Updating

```bash
cd /opt/erp-system && sudo git pull
cd backend && sudo npm ci --omit=dev && erp_run scripts/migrate.js
cd ../frontend && sudo npm ci && sudo npm run build && sudo cp -r dist/. /var/www/erp/
sudo systemctl restart erp-api
scripts/smoke-test.sh https://erp.example.com
```

---

## Health checks

| Endpoint | Meaning | Use it for |
|---|---|---|
| `GET /api/health/live` | The process is up. Never touches the database. | Restart decisions (container or orchestrator liveness). A database outage must not restart every API instance. |
| `GET /api/health/ready` | MySQL answers within 2 s and the process is not shutting down. | Load balancer target health, `depends_on`, uptime monitors. |
| `GET /api/health` | Alias of `ready`, kept for existing monitors. | |
| `GET /healthz` (nginx) | The web container is serving. | The web container's own health check. |

Health checks are exempt from rate limiting and from the access log.

Verified behaviour (with the compose stack):
- MySQL stopped: `ready` returns 503 within milliseconds and `live` stays 200.
  When MySQL is back, the API recovers by itself with no restart.
- `docker stop`: the API reports not-ready, finishes in-flight requests, closes
  the pool and exits 0. It is forced to exit after 10 s.
- MySQL slow to start: the API retries the connection for about 20 s before
  exiting.

**What to alert on:** `ready` failing for more than a minute; any `"level":50`
(error) or `60` (fatal) log line; a burst of `LOGIN_FAILED` entries in the
audit log.

## Configuration checks

The API validates its whole configuration at startup and lists every problem
at once instead of failing on the first, or on the first request that needs
the value. It refuses to start when:

- `DB_HOST`, `DB_USER`, `DB_NAME` or `JWT_SECRET` is missing.
- `PORT` / `DB_PORT` / the rate limits are not whole numbers in range;
  `NODE_ENV`, `LOG_LEVEL`, `CLIENT_URL`, `JWT_EXPIRES_IN` or `COOKIE_SECURE`
  is malformed.
- In production: `JWT_SECRET` is shorter than 32 characters or still the
  example value; `DB_PASSWORD` is empty.
- Only one of `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` is set.

It starts but logs a warning when only one of `AWS_REGION` / `S3_BUCKET_NAME`
is set (uploads stay off), or when `COOKIE_SECURE=false` in production.

## Environment variables (API)

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` turns on secure cookies and the stricter checks above. |
| `PORT` | `4000` | |
| `DB_HOST`, `DB_USER`, `DB_NAME` | required | |
| `DB_PASSWORD` / `DB_PASSWORD_FILE` | empty | Required in production. |
| `DB_PORT` | `3306` | |
| `JWT_SECRET` / `JWT_SECRET_FILE` | required | 32+ characters in production: `openssl rand -base64 48`. Changing it signs everyone out. |
| `JWT_EXPIRES_IN` | `1d` | Session length: `12h`, `7d`, seconds… |
| `CLIENT_URL` | `http://localhost:5173` | The origin allowed by CORS. Same-origin in production, so set it to the public URL. |
| `TRUST_PROXY` | `0` | Number of proxies in front of the API. See [Put HTTPS in front](#5-put-https-in-front). |
| `COOKIE_SECURE` | `true` in production | `false` only for plain-http trials. |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`. |
| `API_RATE_LIMIT_MAX` | `300` | Requests per minute per IP, whole API. |
| `LOGIN_RATE_LIMIT_MAX` | `10` | Failed logins per 15 minutes per IP. |
| `AWS_REGION`, `S3_BUCKET_NAME` | empty | Both set = document storage on. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` / `_FILE` | empty | Leave empty on EC2 and use an IAM role. |

The compose file adds `MYSQL_ROOT_PASSWORD`, `PUBLIC_URL`, `WEB_PORT` and
`WEB_BIND` (see `.env.example` at the repository root).

## S3 document storage (optional)

1. Create a private bucket (Block Public Access on, default encryption on).
2. Give the API an IAM role (EC2) or a dedicated user with only this policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::YOUR-BUCKET/*"
     }]
   }
   ```
3. Set `AWS_REGION` and `S3_BUCKET_NAME`. Downloads use presigned URLs that
   expire, so the bucket never needs to be public.

## Before going live

- [ ] Secrets generated with `openssl rand`, `.env` is `chmod 600`, and nothing is committed.
- [ ] Served over HTTPS; `PUBLIC_URL` is `https://…`; `COOKIE_SECURE` left unset.
- [ ] `TRUST_PROXY` matches the number of proxies (check an audit log row shows a real client IP).
- [ ] MySQL is not reachable from the internet (the compose file does not publish it).
- [ ] First admin made with `create-admin`; no demo accounts.
- [ ] Backups scheduled, copied off the machine, and a restore tried once.
- [ ] `scripts/smoke-test.sh` passes against the public URL.
- [ ] An uptime monitor is watching `/api/health/ready`.

## Scaling notes

- The API is stateless (JWT sessions), so it can run as several instances
  behind a load balancer. **But** the rate limiters keep their counters in
  memory, per instance. With N instances, a client effectively gets N times
  the limits. Move them to a shared store (for example `rate-limit-redis`)
  before scaling out.
- Each instance opens up to 10 MySQL connections (the pool size in
  `backend/src/config/db.js`). Keep instances × 10 under MySQL's
  `max_connections`.

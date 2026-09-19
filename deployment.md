# Deployment Guide

**ispbills** — Vite + React frontend served by nginx, backed by Express + Prisma API on PostgreSQL.

---

## Architecture

```
Browser ──https──▶ nginx (port 443)
                      │
                      ├── /api/* ──▶ Express (port 3001) ──▶ PostgreSQL
                      │
                      └── /* ──▶ dist/index.html (SPA)
```

---

## Prerequisites (VPS)

- Ubuntu/Debian VPS with root access
- Domain name pointing to the VPS (A record)
- nginx installed
- PostgreSQL 16+ installed and running
- Node.js 18+ installed

---

## 1. Set up PostgreSQL

```bash
sudo -u postgres psql -c "CREATE DATABASE ispbills;"
sudo -u postgres psql -c "CREATE USER isp_user WITH PASSWORD 'Ihsaan231460';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ispbills TO isp_user;"
```

Verify the connection:

```bash
PGPASSWORD=Ihsaan231460 psql -U isp_user -d ispbills -h localhost -c "SELECT 1"
```

---

## 2. Deploy the code

### Option A — Git clone

```bash
cd /root
mkdir -p apps
git clone <your-repo-url> apps/surfnet
cd apps/surfnet
```

### Option B — Rsync from dev machine

```bash
rsync -avz --exclude node_modules --exclude .env --exclude .git \
  ./ root@<vps-ip>:/root/apps/surfnet/
```

Then on the VPS:

```bash
cd /root/apps/surfnet
npm install
```

---

## 3. Environment variables

Create `/root/apps/surfnet/.env`:

```env
# Database
DATABASE_URL="postgresql://isp_user:Ihsaan231460@localhost:5432/ispbills"

# Auth — generate a random secret
JWT_SECRET="$(openssl rand -hex 32)"

# Server
PORT=3001

# CORS — must match your public domain
CORS_ORIGIN="https://your-domain.com"
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing auth tokens |
| `PORT` | No | Express port (default 3001) |
| `CORS_ORIGIN` | Yes | Frontend URL with protocol |

---

## 4. Set DATABASE_URL in shell profile

Add to `~/.bashrc` so it persists across logins:

```bash
echo 'export DATABASE_URL="postgresql://isp_user:Ihsaan231460@localhost:5432/ispbills"' >> ~/.bashrc
source ~/.bashrc
```

This is needed because Prisma 7 CLI commands (`db push`, `db seed`, `studio`) read this variable from the shell environment.

---

## 5. Push the database schema

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

---

## 6. Seed the admin user

```bash
npx prisma db seed
```

Expected output: `Admin user created: admin@oceantune.com / Ihsaan231460`

You can change the default credentials by setting these in `.env` before seeding:

```env
SEED_ADMIN_EMAIL="admin@yourdomain.com"
SEED_ADMIN_PASSWORD="your-password"
SEED_ADMIN_NAME="Admin"
```

---

## 7. Build the frontend

```bash
VITE_API_URL="https://your-domain.com/api" npm run build
```

> `VITE_API_URL` must be the **public URL** of your API including `/api`.  
> Example: `https://ispbills.yourdomain.com/api` or `https://your-domain.com/api`

This creates the `dist/` folder with the compiled frontend.

---

## 8. Build the Express server

```bash
npm run build:server
```

This creates `server/dist/` with the compiled API.

---

## 9. nginx configuration

Create `/etc/nginx/sites-available/ispbills`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # API proxy — forward /api/* to Express on port 3001
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static frontend
    root /root/apps/surfnet/dist;
    index index.html;

    # Cache static assets (hashed filenames)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback — serve index.html for all non-file routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/ispbills /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 10. SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

After SSL is set up, update `.env` so `CORS_ORIGIN` uses `https://`:

```bash
# Edit /root/apps/surfnet/.env and change:
CORS_ORIGIN="https://your-domain.com"
```

Then restart the API:

```bash
pm2 restart ispbills-api
```

---

## 11. Run the Express server with pm2

```bash
npm install -g pm2
pm2 start /root/apps/surfnet/server/dist/index.js --name ispbills-api
pm2 save
pm2 startup
```

Verify it's running:

```bash
curl http://localhost:3001/api/health
# → { "ok": true }
```

Also verify via nginx:

```bash
curl https://your-domain.com/api/health
# → { "ok": true }
```

---

## 12. First-time access

Open your browser at `https://your-domain.com`.

- The app detects no users exist and shows a **bootstrap form**
- Create the first admin account (email + password)
- After creation, you can manage staff accounts under **Admin** in the sidebar

---

## Updating the app

```bash
cd /root/apps/surfnet

# Pull latest code
git pull
# or rsync from dev machine

# Install any new dependencies
npm install

# Push schema changes (if any)
npx prisma db push

# Rebuild frontend
VITE_API_URL="https://your-domain.com/api" npm run build

# Rebuild server
npm run build:server

# Restart API
pm2 restart ispbills-api
```

No nginx reload needed for file changes.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Blank page or 404 on route | Missing SPA fallback in nginx | Check `try_files $uri $uri/ /index.html;` in the `location /` block |
| API returns 502 Bad Gateway | Express not running | `pm2 status` — if stopped, `pm2 start ispbills-api` |
| `prisma db push` fails | `DATABASE_URL` not set | Run `export DATABASE_URL="..."` or add to `~/.bashrc` |
| Sign-in says "Invalid credentials" | Seed not run or wrong password | Run `npx prisma db seed` — creates `admin@oceantune.com` |
| CORS errors in browser | `CORS_ORIGIN` doesn't match the actual domain | Check `/root/apps/surfnet/.env` and restart API |
| `prisma db seed` fails to connect | `DATABASE_URL` not set | The seed file loads `.env` automatically — check `.env` exists |

---

## Local development (Windows)

```powershell
# Terminal 1 — Express API
$env:DATABASE_URL="postgresql://isp_user:Ihsaan231460@localhost:5432/ispbills"
npx tsx watch server/index.ts

# Terminal 2 — Vite frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Environment Variables Reference

| Variable | Where | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | `.env` + shell env | Yes | PostgreSQL connection string |
| `JWT_SECRET` | `.env` | Yes | Auth token signing secret |
| `PORT` | `.env` | No | Express listen port (default 3001) |
| `CORS_ORIGIN` | `.env` | Yes | Frontend URL for CORS headers |
| `VITE_API_URL` | Build command | Yes | Public API URL (e.g. `https://domain.com/api`) |
| `SEED_ADMIN_EMAIL` | `.env` | No | Admin email for seed (default: `admin@oceantune.com`) |
| `SEED_ADMIN_PASSWORD` | `.env` | No | Admin password for seed (default: `Ihsaan231460`) |
| `SEED_ADMIN_NAME` | `.env` | No | Admin name for seed (default: `Admin`) |

# Deployment Guide

**ispbills** is a **Vite + React frontend** served by nginx, backed by an **Express + Prisma API** on PostgreSQL.

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

## Prerequisites

- A domain name pointing to your VPS (A record)
- nginx installed on the VPS
- PostgreSQL installed and running on the VPS
- Node.js 18+ on the VPS

---

## 1. Set up PostgreSQL

```bash
sudo -u postgres psql -c "CREATE DATABASE ispbills;"
sudo -u postgres psql -c "CREATE USER ispbills WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ispbills TO ispbills;"
```

---

## 2. Clone or copy the project, then install

```bash
# If cloning from git:
# git clone <your-repo> /root/apps/ispot

# If copying from dev machine:
# rsync -avz --exclude node_modules --exclude .env ./ user@your-vps:/root/apps/ispot

cd /root/apps/ispot
npm install
```

---

## 3. Environment variables

Edit `/root/apps/ispot/.env`:

```env
DATABASE_URL="postgresql://ispbills:your-password@localhost:5432/ispbills"
JWT_SECRET="generate-a-random-secret-here"
PORT=3001
CORS_ORIGIN="https://your-domain.com"
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing auth tokens. Generate one: `openssl rand -hex 32` |
| `PORT` | No | Express port (default 3001) |
| `CORS_ORIGIN` | Yes | Frontend URL — your domain with https |

---

## 4. Push the database schema

```bash
npx prisma db push
```

---

## 5. Build the frontend

```bash
VITE_API_URL="https://your-domain.com/api" npm run build
```

> **Important**: `VITE_API_URL` must be the **public** URL of your API, including `/api`.  
> Example: `https://ispbills.yourdomain.com/api`

This produces the `dist/` folder.

---

## 6. Build the server

```bash
npm run build:server
```

This produces the `server/dist/` folder.

---

## 7. nginx configuration

Create `/etc/nginx/sites-available/ispbills`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # API proxy — forward /api/* to Express
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static frontend
    root /root/apps/ispot/dist;
    index index.html;

    # Cache static assets aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
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

## 8. SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

After SSL is set up, update `.env` so `CORS_ORIGIN` uses `https://`.

---

## 9. Run the Express server

Use **pm2** to keep the API running:

```bash
npm install -g pm2
pm2 start /root/apps/ispot/server/dist/index.js --name ispbills-api
pm2 save
pm2 startup
```

Verify it's running:

```bash
curl http://localhost:3001/api/health
# → { "ok": true }
```

---

## Full update script

```bash
cd /root/apps/ispot
git pull
npm install

# Push any schema changes
npx prisma db push

# Rebuild frontend
VITE_API_URL="https://your-domain.com/api" npm run build

# Rebuild server
npm run build:server

# Restart API
pm2 restart ispbills-api
```

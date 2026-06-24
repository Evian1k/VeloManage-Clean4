# VeloManage — Deployment Runbook

This guide fixes the `MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster` error and gets the VeloManage backend live on Render.

---

## TL;DR — the 3 things you must do

1. **MongoDB Atlas → Network Access → Add `0.0.0.0/0`** (or your Render outbound IP).
2. **Render → Environment tab → verify `MONGODB_URI`, `JWT_SECRET`, `ADMIN_PASSWORD`, `FRONTEND_URL`.**
3. **Render → Manual Deploy → Deploy latest commit.**

The code fixes have already been applied (resilient Mongo retry, proper health check, dynamic CORS, socket URL fix). Once the IP whitelist is open and env vars are correct, the service will boot.

---

## Root cause of the crash

```
MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster.
reason: TopologyDescription { type: 'ReplicaSetNoPrimary', commonWireVersion: 0 }
```

- `ReplicaSetNoPrimary` + `commonWireVersion: 0` means the driver **never completed a handshake** with any of the 3 shard nodes.
- That is the signature of an **Atlas IP Access List block**, not a wrong password (wrong password returns an authentication error, not this).
- Render's egress IP is not whitelisted in Atlas, so all 3 nodes refused the TCP connection.
- The old `server.js` then called `process.exit(1)`, which made Render kill the service and email you the "Server failure detected" alert.

The new `server.js` retries with exponential backoff and never crashes the process — but you still need to fix the whitelist so the connection actually succeeds.

---

## Step 1 — Open Atlas Network Access

1. Log in to **https://cloud.mongodb.com**
2. Select your project / cluster (`Cluster0` / `dypf6w2`)
3. Left sidebar → **Network Access** (under Security)
4. Click **Add IP Address**
5. Choose one of:
   - **Allow Access From Anywhere** → adds `0.0.0.0/0` (recommended for SaaS backends; safe as long as your DB user has a strong password — Atlas traffic is always TLS-encrypted)
   - **Add Current IP Address** → only works from your laptop, not Render
   - **Custom** → paste Render's static outbound IP (see Step 1b)
6. Click **Confirm**. Wait ~30s for status to become `Active`.

### Step 1b — Find Render's outbound IP (optional, if you don't want `0.0.0.0/0`)

- Free / Starter Render web services use **dynamic** egress IPs, so `0.0.0.0/0` is effectively required.
- Paid Render plans (Standard+) offer static outbound IPs:
  - Render dashboard → your service → **Settings** → scroll to **Outbound IP Addresses**
  - Add each IP individually to Atlas Network Access.

---

## Step 2 — Verify Atlas Database User

1. Atlas → **Database Access** (left sidebar)
2. Confirm a user exists (e.g. `EmmanuelRizy`) with role `readWriteAnyDatabase` (or `readWrite` on the specific DB)
3. Confirm the password matches what's URL-encoded in `MONGODB_URI`
4. If you reset the password, regenerate the URI with the new password (URL-encode any special chars)

---

## Step 3 — Set Render Environment Variables

Render dashboard → your service (`VeloManage-Clean4-2`) → **Environment** tab.

| Key | Value | Notes |
|-----|-------|-------|
| `MONGODB_URI` | `mongodb+srv://USER:PASSWORD@cluster0.dypf6w2.mongodb.net/autocare-pro?retryWrites=true&w=majority&appName=Cluster0` | URL-encode password if it has special chars |
| `JWT_SECRET` | (64-char hex string) | Generate with `openssl rand -hex 32` locally |
| `ADMIN_PASSWORD` | `autocarpro12k@12k.wwc` | Or rotate to a stronger value |
| `FRONTEND_URL` | `https://velo-manage-clean4.vercel.app` | Your Vercel frontend URL |
| `SOCKET_CORS_ORIGIN` | `https://velo-manage-clean4.vercel.app` | Same as FRONTEND_URL |
| `NODE_ENV` | `production` | |
| `PORT` | `10000` | Render injects its own PORT automatically; this is a fallback |
| `API_VERSION` | `v1` | |

Click **Save Changes** — Render will auto-redeploy.

---

## Step 4 — (Frontend) Set Vercel Environment Variables

Vercel dashboard → your project → **Settings** → **Environment Variables**.

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://velomanage-clean4-2.onrender.com/api/v1` |
| `VITE_SOCKET_URL` | `https://velomanage-clean4-2.onrender.com` |
| `VITE_FRONTEND_URL` | `https://velo-manage-clean4.vercel.app` |

Redeploy the frontend after saving.

---

## Step 5 — Verify

1. After Render deploy finishes, visit:
   `https://velomanage-clean4-2.onrender.com/health`
   
   You should see:
   ```json
   {
     "status": "OK",
     "database": { "state": "connected", "connected": true }
   }
   ```
   If `status` is `DEGRADED`, the DB is still not connecting — re-check Steps 1–3.

2. Visit:
   `https://velomanage-clean4-2.onrender.com/`
   Should return JSON listing all endpoints.

3. Tail the Render logs — you should see:
   ```
   🔌 Connecting to MongoDB (attempt 1)...
   ✅ Connected to MongoDB
   🚀 VeloManage Backend running on port 10000
   ```

---

## Step 6 — Test login from the frontend

Open `https://velo-manage-clean4.vercel.app/login` and try an admin login:

- Email: `emmanuel.evian@autocare.com`
- Password: `autocarpro12k@12k.wwc`

If it works, the entire stack is healthy.

---

## What was fixed in this commit

### `backend/server.js` (full rewrite)

| Before | After |
|--------|-------|
| `mongoose.connect().catch(() => process.exit(1))` — service dies on first DB error | `connectMongo()` retries with exponential backoff (2s → 4s → 8s → 16s → 30s cap) and never kills the process |
| Health check always returned `OK` even when DB was down | Health check returns `503 DEGRADED` with `database.connected: false` when DB is not connected — Render's health probe can now react |
| Hardcoded CORS origins | Reads from `FRONTEND_URL` + `ADDITIONAL_CORS_ORIGINS` env vars, with safe dev defaults |
| Socket CORS hardcoded to `localhost:5173` | Socket CORS uses same dynamic origin list as Express |
| `import './src/routes/dashboard.js  '` (trailing whitespace — fragile) | Trimmed path |
| 404 catch-all registered AFTER `errorHandler` (incorrect order) | 404 catch-all registered BEFORE `errorHandler` (standard Express order) |
| No graceful shutdown for socket.io / mongoose | `shutdown()` cleanly closes HTTP, socket.io, and mongoose on SIGTERM/SIGINT |
| No `uncaughtException` / `unhandledRejection` handlers | Both handlers log and keep the process alive |
| No `trust proxy` setting | `app.set('trust proxy', 1)` so `req.ip` and rate-limit keys work behind Render's proxy |
| No `/ready` endpoint for k8s-style probes | Added `/ready` (returns 200 only if DB is connected) |

### `frontend/src/contexts/SocketContext.jsx`

- Bug: was passing `VITE_API_URL` (which includes `/api/v1`) as the Socket.io host. Socket.io would try to connect to `https://host/api/v1` and fail with a 404 handshake error.
- Fix: uses `VITE_SOCKET_URL` env var, or strips the `/api/...` suffix from `VITE_API_URL`.
- Added `transports: ['websocket', 'polling']`, `reconnection: true`, and explicit reconnection attempts.

### `.env.example` files

- Removed the **real MongoDB credentials** that were committed to git (the old `backend/.env.example` had `mongodb+srv://EmmanuelRizy:FQqmlVdhfVgaUZVZ@...`). **Rotate that MongoDB user's password immediately** in Atlas → Database Access → edit user → set new password. Anyone who ever saw the public repo has those credentials.
- Added clear instructions on URL-encoding special characters in the Mongo password.
- Standardised variable names across root / frontend / backend examples.

### `render.yaml`

- Added a Render Blueprint so the service can be re-created with one click if needed.
- Uses `healthCheckPath: /health` so Render knows when the service is actually ready.

---

## Security follow-up — DO THIS NOW

1. **Rotate the MongoDB user password** that was leaked in the old `.env.example`:
   - Atlas → Database Access → edit `EmmanuelRizy` → set a new strong password
   - Update `MONGODB_URI` in Render with the URL-encoded new password
2. **Rotate `ADMIN_PASSWORD`** to something stronger than `autocarpro12k@12k.wwc` (this was also in git). Update the value in Render env vars.
3. **Generate a strong `JWT_SECRET`** locally: `openssl rand -hex 32`. Set it in Render env vars. Never reuse the fallback value.

---

## Troubleshooting

### "Still getting ReplicaSetNoPrimary after deploy"

- Re-check Step 1 — Atlas Network Access list status must be `Active`, not `Pending`
- The IP `0.0.0.0/0` must be a single entry, not `0.0.0.0` (without `/0`)
- Hard refresh the Atlas page; sometimes the UI lags

### "Authentication failed" (different error)

- Wrong DB user password → Step 2
- Wrong username in URI → Step 2
- Password has special chars and isn't URL-encoded → Step 3

### "CORS error" in browser console

- `FRONTEND_URL` env var on Render doesn't match your actual Vercel URL
- Add the exact origin (including `https://`) to `ADDITIONAL_CORS_ORIGINS` if needed

### "Socket.io connection failed"

- `VITE_SOCKET_URL` not set on Vercel, OR
- `SOCKET_CORS_ORIGIN` on backend doesn't match the frontend URL

### Render still says "Server failure detected" after fix

- Render's deployment may still be running the old code. Trigger a manual deploy:
  - Render dashboard → your service → top right **Manual Deploy** → **Deploy latest commit**
- Check the logs live during boot — first 10 seconds should show the Mongo connection attempt

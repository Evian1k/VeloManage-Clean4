# VeloManage — Deployment Guide

This document covers three deployment paths for VeloManage:

1. **Local Docker dev** — `docker compose up` (fastest path to a running stack)
2. **Render (managed PaaS)** — uses `render.yaml` blueprint; auto-deploys on push
3. **Kubernetes (self-hosted production)** — `k8s/` manifests with HPA, PDB, Ingress

Plus: blue/green strategy, monitoring & alerting, MongoDB backup, and scaling.

---

## 1. Architecture at a glance

```
                ┌─────────────────────────────────────────────┐
                │              Load balancer / CDN            │
                └───────────────┬─────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
        ┌───────▼────────┐              ┌──────▼─────────┐
        │  Frontend (SPA)│              │   Backend API  │
        │  nginx + Vite  │              │  Express+Mngse │
        │  :80 / :8080   │  /api/* ───► │  :10000        │
        └────────────────┘              └────┬───────────┘
                                            │
                              ┌─────────────┼─────────────┐
                              │             │             │
                       ┌──────▼─────┐  ┌────▼────┐  ┌─────▼─────┐
                       │  MongoDB   │  │  Redis  │  │ Prometheus│
                       │  (Atlas)   │  │ (cache) │  │  /metrics │
                       └────────────┘  └─────────┘  └───────────┘
```

| Component      | Tech                                   | Port  |
| -------------- | -------------------------------------- | ----- |
| Backend API    | Node.js 20 + Express 4 + Mongoose 7    | 10000 |
| Frontend SPA   | Vite 4 + React 18 served by nginx      | 80    |
| MongoDB        | Mongo 7 (Atlas in prod, container dev) | 27017 |
| Redis (future) | Redis 7 (sessions / queue / cache)     | 6379  |

---

## 2. Local Docker development

The repo ships with a `docker-compose.yml` that brings up **mongo + redis + backend + frontend** in a single network.

### Prerequisites

- Docker 24+ with the Compose v2 plugin
- 2 GB free RAM (Mongo + Redis + Node)

### First run

```bash
# Optional: create a .env at repo root with overrides
cat > .env <<'EOF'
MONGO_USER=velo
MONGO_PASS=velopass
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD=admin123
EOF

# Build + start everything in the background
docker compose up -d --build

# Tail logs
docker compose logs -f backend

# Check health
curl http://localhost:10000/health
curl http://localhost:8080/        # frontend
```

### Endpoints

| URL                                 | What                  |
| ----------------------------------- | --------------------- |
| http://localhost:8080               | React SPA             |
| http://localhost:8080/api/v1/...    | Proxied to backend    |
| http://localhost:8080/socket.io/    | WebSocket (proxied)   |
| http://localhost:10000/health       | Backend health        |
| http://localhost:10000/metrics      | Prometheus metrics    |
| http://localhost:27017              | MongoDB (host port)   |
| http://localhost:6379               | Redis (host port)     |

### Tear-down

```bash
docker compose down            # stop containers
docker compose down -v         # also delete mongo_data + redis_data  (DESTRUCTIVE)
```

---

## 3. Render deployment (managed PaaS)

Render reads [`render.yaml`](../../render.yaml) and creates the backend service automatically.
**Pushes to `main` trigger an automatic redeploy** — no manual deploy step needed.

### One-time setup

1. Push the repo to GitHub.
2. In the Render dashboard: **New → Blueprint → select this repo**.
3. Render reads `render.yaml` and provisions `velomanage-backend`.
4. Set the following env vars in the Render dashboard (they're marked `sync: false` in `render.yaml`):

   | Key                | How to generate                                                          |
   | ------------------ | ------------------------------------------------------------------------ |
   | `MONGODB_URI`      | From MongoDB Atlas → Connect → Drivers → Node.js                         |
   | `JWT_SECRET`       | `openssl rand -hex 32`                                                   |
   | `ADMIN_PASSWORD`   | A strong password (used by `scripts/init-database.js` on first boot)     |
   | `FRONTEND_URL`     | `https://velo-manage-clean4.vercel.app` (or your custom domain)          |
   | `SOCKET_CORS_ORIGIN` | Same as `FRONTEND_URL`                                                 |

5. In **Mongo Atlas → Network Access**, allow Render's outbound IPs (or `0.0.0.0/0` if your DB password is strong).
6. Trigger a manual deploy (or just push a commit) — Render runs `npm ci --omit=dev && node server.js`.
7. Confirm the service is live: `curl https://<your-backend>.onrender.com/health`.

### Frontend on Vercel

The frontend is independent of Render — it builds to static files and is typically deployed on Vercel/Netlify/Cloudflare Pages. Point its build command at `npm run build` and the output dir at `dist`.

### Notes on Render's free tier

- The free tier spins the service down after 15 min of inactivity (cold start ~30 s). Switch to the **Starter** plan for production.
- Free-tier services do **not** get a static outbound IP. Atlas IP whitelisting is more painful on free — `0.0.0.0/0` is the practical choice.

---

## 4. Kubernetes production deployment

The `k8s/` directory contains production-ready manifests:

| File                            | Purpose                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `namespace.yaml`                | `velomanage` namespace                                     |
| `configmap.yaml`                | Non-secret config (`NODE_ENV`, `API_VERSION`, etc.)        |
| `secret.yaml.example`           | Template for secrets — copy to `secret.yaml`, fill in      |
| `backend-deployment.yaml`       | 3 replicas, resource limits, liveness/readiness/startup probes, anti-affinity |
| `backend-service.yaml`          | ClusterIP on :10000                                        |
| `frontend-deployment.yaml`      | 2 replicas, resource limits, probes, anti-affinity         |
| `frontend-service.yaml`         | ClusterIP on :80                                           |
| `ingress.yaml`                  | Path-based routing (`/api` & `/socket.io` → backend, `/` → frontend) + TLS |
| `hpa.yaml`                      | HorizontalPodAutoscaler: backend min 3, max 20, target CPU 70 % |
| `pdb.yaml`                      | PodDisruptionBudget: min 2 backend pods always available   |

### Apply order

```bash
# 1. Create namespace
kubectl apply -f k8s/namespace.yaml

# 2. Create config + secrets
kubectl apply -f k8s/configmap.yaml
cp k8s/secret.yaml.example k8s/secret.yaml
# edit k8s/secret.yaml with real values (DO NOT COMMIT)
kubectl apply -f k8s/secret.yaml

# 3. Deploy backend & frontend
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# 4. Autoscaling + disruption budget
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml

# 5. Ingress (requires an ingress controller, e.g. ingress-nginx)
kubectl apply -f k8s/ingress.yaml
```

> **Tip:** For real production, manage this with Helm or Kustomize and apply via GitOps (Argo CD / Flux). The manifests here are intentionally plain YAML so they're easy to read and adapt.

### Verifying the deploy

```bash
kubectl -n velomanage get pods,svc,ingress,hpa,pdb
kubectl -n velomanage rollout status deploy/velomanage-backend
kubectl -n velomanage port-forward svc/velomanage-backend 10000:10000
curl http://localhost:10000/health
```

### Resource limits

| Component | CPU req | CPU lim | Mem req | Mem lim |
| --------- | ------- | ------- | ------- | ------- |
| backend   | 250m    | 1000m   | 256Mi   | 768Mi   |
| frontend  | 100m    | 300m    | 64Mi    | 128Mi   |

Tune these based on the HPA's behaviour and your cluster's node size.

### TLS

The Ingress expects `velomanage-tls` to exist. With cert-manager installed:

```bash
# ClusterIssuer (one-time)
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata: { name: letsencrypt-prod }
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@velomanage.example.com
    privateKeySecretRef: { name: letsencrypt-prod }
    solvers:
      - http01: { ingress: { class: nginx } }
EOF
```

Then uncomment the `cert-manager.io/cluster-issuer` annotation in `k8s/ingress.yaml`.

---

## 5. Blue/Green deployment on Kubernetes

VeloManage uses the standard **Service selector swap** blue/green pattern.

### Goal

- **Blue** = the currently-serving version (receives live traffic).
- **Green** = the new version, deployed in parallel, smoke-tested, then promoted to live.

### Procedure

1. **Deploy green** alongside blue (different Deployment name + label):

   ```yaml
   # k8s/backend-deployment-green.yaml (generated from CI on each release)
   metadata:
     name: velomanage-backend-green   # ← green
   template:
     metadata:
       labels:
         app.kubernetes.io/name: velomanage-backend
         app.kubernetes.io/version: green   # ← selector pivot
         app.kubernetes.io/component: api
   spec:
     replicas: 3
   ```

   ```bash
   kubectl apply -f k8s/backend-deployment-green.yaml
   kubectl -n velomanage rollout status deploy/velomanage-backend-green
   ```

2. **Smoke test green** without exposing it to the public Ingress:

   ```bash
   kubectl -n velomanage run smoke-test --rm -it --image=curlimages/curl --restart=Never -- \
     curl -fsS http://velomanage-backend-green:10000/health
   ```

   > The Service doesn't yet route to `green`, so this requires a temporary headless Service or `kubectl port-forward deploy/velomanage-backend-green 10000:10000`.

3. **Flip the Service selector** to `version: green`:

   ```yaml
   # k8s/backend-service.yaml
   spec:
     selector:
       app.kubernetes.io/name: velomanage-backend
       app.kubernetes.io/version: green   # ← was blue
   ```

   ```bash
   kubectl apply -f k8s/backend-service.yaml
   ```

   Traffic now flows to green. Because the Service selector changes atomically, clients see a near-instant cutover (existing keep-alive connections drain over ~30 s).

4. **Roll back if needed** — flip the selector back to `version: blue` and re-apply.

5. **Clean up the old version** once green has baked for 24 h:

   ```bash
   kubectl -n velomanage delete deploy velomanage-backend-blue
   ```

### Notes

- For **canary** instead of blue/green, use Argo Rollouts or Flagger — they automate weighted traffic shifting via the Ingress controller.
- For zero-downtime, your DB schema changes must be **backward-compatible** with both blue and green versions. Apply additive migrations before the cutover; destructive ones after.

---

## 6. Monitoring & alerting

### `/metrics` endpoint

The backend exposes **Prometheus-format** metrics at `GET /metrics` (see `backend/src/middleware/monitoring.js`):

| Metric                          | Type      | Labels                          |
| ------------------------------- | --------- | ------------------------------- |
| `http_requests_total`           | counter   | `method`, `route`, `status`     |
| `http_request_duration_seconds` | histogram | `method`, `route`, `status`     |
| `active_connections`            | gauge     | —                               |
| `db_connections`                | gauge     | —                               |

The histogram uses default Prometheus buckets (`0.005` … `10` s) suitable for HTTP latency.

### Prometheus scrape config

```yaml
# prometheus.yml
scrape_configs:
  - job_name: velomanage-backend
    metrics_path: /metrics
    static_configs:
      - targets: ["velomanage-backend:10000"]
    # Or use k8s service discovery:
    # kubernetes_sd_configs:
    #   - role: pod
    # relabel_configs:
    #   - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
    #     action: keep
    #     regex: "true"
```

The backend Deployment already ships these annotations (`k8s/backend-deployment.yaml`):

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "10000"
  prometheus.io/path: "/metrics"
```

### Grafana dashboard

Recommended panels (provision via `grafana/dashboards/velomanage.json`):

1. **Request rate** — `rate(http_requests_total[1m])` by route
2. **p50 / p95 / p99 latency** — histogram_quantile on `http_request_duration_seconds`
3. **Error rate** — `rate(http_requests_total{status=~"5.."}[5m])` divided by total
4. **Active connections** — `active_connections`
5. **DB connection pool** — `db_connections` (vs. `maxPoolSize=10`)
6. **Pod CPU / Memory** — `container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`

### Alerting rules (Alertmanager)

| Alert                    | Expression                                                     | For         |
| ------------------------ | -------------------------------------------------------------- | ----------- |
| `HighErrorRate`          | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05` | 5 min       |
| `HighLatencyP95`         | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1` | 5 min       |
| `BackendPodsDown`        | `kube_deployment_status_replicas_available{deployment="velomanage-backend"} < 3` | 2 min       |
| `MongoDisconnected`      | `db_connections == 0`                                          | 1 min       |
| `CertExpiringSoon`       | `probe_ssl_earliest_cert_expiry - time() < 86400 * 14`         | 1 h         |

Page on-call via PagerDuty / OpsGenie for the first four; email for the last.

---

## 7. MongoDB backup & recovery

### Strategy

| Layer               | What it protects                | Frequency        | Retention       |
| ------------------- | ------------------------------- | ---------------- | --------------- |
| Daily snapshots     | Logical / on-disk full backup   | 1× / day (off-peak) | 30 days      |
| Point-in-time recovery (PITR) | All writes between snapshots | Continuous (oplog) | 24–72 h     |
| Cross-region copy   | Regional outage                 | 1× / day         | 7 days          |

### Atlas (recommended for production)

Atlas provides all three layers natively:

1. **PITR**: Cluster → Backup → Continuous → Enable. Pick a 24–72 h window.
2. **Scheduled snapshots**: Cluster → Backup → Schedule. Daily at 03:00 UTC, 30-day retention.
3. **Cloud backup copy**: replicate snapshots to a second region for DR.

Restore: Atlas → Backup → Restore → "Download snapshot" or "Spin up new cluster from snapshot".

### Self-hosted Mongo (e.g. docker-compose dev)

For the dev `mongo` container, use `mongodump`:

```bash
# One-off backup
docker exec velomanage-mongo sh -c \
  'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
   --authenticationDatabase admin --db velomanage --archive' > backup-$(date +%F).archive

# Restore
docker exec -i velomanage-mongo sh -c \
  'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
   --authenticationDatabase admin --archive --drop' < backup-2025-01-01.archive
```

### Cron (k8s CronJob example)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongo-backup
  namespace: velomanage
spec:
  schedule: "0 3 * * *"           # daily at 03:00
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: mongodump
              image: mongo:7
              env:
                - name: MONGODB_URI
                  valueFrom:
                    secretKeyRef: { name: velomanage-secrets, key: MONGODB_URI }
              command:
                - sh
                - -c
                - |
                  mongodump "$MONGODB_URI" --archive=/backup/velomanage-$(date +%F).archive --gzip
              volumeMounts:
                - { name: backup, mountPath: /backup }
          volumes:
            - name: backup
              persistentVolumeClaim: { claimName: mongo-backup-pvc }
```

### Restore testing

**Quarterly restore drills** are mandatory. A backup you've never restored from is a wish, not a backup. Test:

- Restore to a fresh Atlas cluster
- Run the test suite against it
- Spot-check 3 random documents per collection

---

## 8. Scaling strategy

### Horizontal Pod Autoscaler (backend)

`k8s/hpa.yaml` scales the backend based on **CPU (70 % target) and memory (80 % target)**:

- **Min**: 3 pods (matches the PDB `minAvailable: 2`)
- **Max**: 20 pods
- **Scale-up**: up to +100 % or +4 pods per minute
- **Scale-down**: at most −25 % per 2 min (5-min stabilisation)

The HPA requires **metrics-server** in the cluster:

```bash
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm install metrics-server metrics-server/metrics-server \
  -n kube-system --set args="{--kubelet-insecure-tls}"
```

### Frontend scaling

The frontend is stateless static content — it can scale horizontally with no concerns. Add an HPA at 60 % CPU if you're serving very high traffic; in practice nginx can saturate a small node's NIC long before CPU limits bind.

### MongoDB scaling (10 M+ documents)

At **≥ 10 M documents per collection**, a single replica set becomes a bottleneck. Plan for **sharding**:

1. **Choose a shard key** that gives even write distribution and supports your common query patterns.
   - For VeloManage, `organizationId + _id` is a strong candidate (queries are org-scoped).
2. **Enable sharding** per collection:

   ```js
   sh.enableSharding("velomanage")
   sh.shardCollection("velomanage.vehicles", { organizationId: 1, _id: 1 })
   ```
3. **Add shards** as data grows (typically one shard per 200 GB / 50 M docs).
4. **Monitor** `mongod`'s `opcounters` and `connections` per shard — uneven distribution means a bad shard key.

### Vertical scaling (when HPA can't help)

If your workload is CPU-bound per-request (rare for I/O-heavy Node apps), bump the container CPU limit before adding more pods. Memory leaks will manifest as OOMKills — fix the leak, don't just add memory.

### Redis (future)

When you add Redis for sessions / rate-limit store / queue:
- Start with a single `redis:7-alpine` instance (the compose file already provisions this).
- At >1 k req/s, switch to Redis Cluster or a managed offering (ElastiCache / Upstash / Redis Cloud).
- Use `maxmemory-policy: allkeys-lru` (already set in compose) so Redis never crashes from OOM.

---

## 9. Disaster recovery cheat-sheet

| Scenario                  | First action                                                       |
| ------------------------- | ------------------------------------------------------------------ |
| Backend down              | `kubectl -n velomanage rollout restart deploy/velomanage-backend`  |
| DB unreachable            | Check Atlas status page; verify IP whitelist; check `MONGODB_URI`  |
| Bad deploy rolled out     | `kubectl -n velomanage rollout undo deploy/velomanage-backend`     |
| Accidental data deletion  | Atlas → Backup → Restore to point-in-time (within PITR window)     |
| Region outage             | Failover to secondary region; repoint DNS                          |
| Secret leak               | Rotate in secret manager, restart pods, revoke old tokens          |

---

## 10. Further reading

- [Render Blueprint spec](https://render.com/docs/blueprint-spec)
- [MongoDB Atlas backup docs](https://www.mongodb.com/docs/atlas/backup/)
- [Prometheus best practices](https://prometheus.io/docs/practices/naming/)
- [HPA walkthrough](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/)
- [Argo Rollouts for advanced delivery](https://argo-rollouts.readthedocs.io/)

# Deployment

Docker Compose guides for running HireKal services locally or from published images on Docker Hub (`hirekal/api`, `hirekal/media-worker`, `hirekal/console`).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- PostgreSQL database (local install, managed service, or container)
- For database migrations from your machine: **Node.js 24** and `npm install` at the repo root

## 1. Environment setup

```bash
cp apps/api-app/.env.example apps/api-app/.env
cp media-worker/.env.example media-worker/.env
```

Edit both files with real secrets and connection strings.

**API in Docker + Postgres on your host:** use `host.docker.internal` in `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/hirekal
```

**Media worker callback to API on your host:**

```env
TRANSCRIPT_CALLBACK_URL=http://host.docker.internal:3000/api/v1/media-worker-response
```

## 2. Database migrations

Run once before starting the API (from the repo root):

```bash
npm install
npm run migration:run
```

Requires `DATABASE_URL` in `apps/api-app/.env` pointing at a reachable Postgres instance.

## 3. API (`apps/api-app`)

Compose uses `hirekal/api:prod` from Docker Hub.

### Pull and run

```bash
cd apps/api-app
docker compose pull
docker compose up -d
```

### Build locally (optional)

```bash
cd apps/api-app
docker compose up --build -d
```

### Verify

```bash
curl http://localhost:3000/
# HireKal API is Up.
```

### Logs and stop

```bash
cd apps/api-app
docker compose logs -f
docker compose down
```

## 4. Media worker (`media-worker`)

See [media-worker/deploy.md](./media-worker/deploy.md) for full deployment details.

Compose uses `hirekal/media-worker:prod` from Docker Hub.

### Pull and run

```bash
cd media-worker
docker compose pull
docker compose up -d
```

### Build locally (optional)

```bash
cd media-worker
docker compose up --build -d
```

### Verify

```bash
curl http://localhost:8000/health
# {"status":"healthy"}
```

### Logs and stop

```bash
cd media-worker
docker compose logs -f
docker compose down
```

## 5. Docker Hub image tags

CI publishes images on push to `main` / `development` and on GitHub Release:

| Event | Tags |
|-------|------|
| Push to `main` | `prod`, `prod-{sha}` |
| Push to `development` | `dev`, `dev-{sha}` |
| GitHub Release | `latest`, `vX.Y.Z`, `X.Y.Z` |

Compose files pin the `prod` tag (`hirekal/api:prod`, `hirekal/media-worker:prod`). Use a different tag by editing `docker-compose.yml` or passing `-f` with an override file.

## 6. Manual Docker build (without Compose)

From the **repo root** (Dockerfiles expect monorepo context):

```bash
# API
docker build -f apps/api-app/Dockerfile -t hirekal/api:local .
docker run --rm -p 3000:3000 --env-file apps/api-app/.env hirekal/api:local

# Media worker
docker build -t hirekal/media-worker:local media-worker
docker run --rm -p 8000:8000 --env-file media-worker/.env hirekal/media-worker:local

# Console (static nginx)
docker build -f apps/console-app/Dockerfile -t hirekal/console:local .
docker run --rm -p 8080:80 hirekal/console:local
```

## 7. Typical local stack

1. Start Postgres (host or container).
2. `npm run migration:run` from repo root.
3. `cd apps/api-app && docker compose up --build -d`
4. Set `TRANSCRIPT_CALLBACK_URL` in `media-worker/.env`, then `cd media-worker && docker compose up --build -d`
5. Run the console locally with `npm run dev:console`, or build/serve the console Docker image separately.

## Required env vars (API)

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `JWT_SECRET` | Yes | Auth signing secret |
| `PORT` | No | Default `3000` |
| `CORS_ORIGIN` | No | Console origin for browser requests |
| `BREVO_*` | For email | Transactional email |
| `R2_*` | For uploads | Cloudflare R2 presigned uploads |

See `apps/api-app/.env.example` for the full list.

## Required env vars (media worker)

| Variable | Required | Notes |
|----------|----------|-------|
| `WHISPER_MODEL` | No | Default `small` |
| `TRANSCRIPT_CALLBACK_URL` | No | POST transcript to API after success |
| `TEMP_*` | No | Stale temp dir cleanup settings |

See `media-worker/.env.example` for the full list.

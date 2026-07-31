# Media Worker — Deployment

Deploy the HireKal media worker (`hirekal/media-worker`) — a stateless FastAPI service that downloads video, extracts audio with FFmpeg, and transcribes with Faster Whisper.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- (Optional) HireKal API running for transcript callbacks — see [repo deploy.md](../deploy.md)

## 1. Environment setup

```bash
cd media-worker
cp .env.example .env
```

Edit `.env` as needed. Minimum for a basic run: defaults in `.env.example` are enough. For transcript delivery to the API:

```env
TRANSCRIPT_CALLBACK_URL=http://host.docker.internal:3000/api/v1/media-worker-response
```

Use `host.docker.internal` when the API runs on your host and the worker runs in Docker. Adjust host/port if your API listens elsewhere.

## 2. Docker Compose (recommended)

Compose pulls `hirekal/media-worker:prod` from Docker Hub.

### Pull and run

```bash
cd media-worker
docker compose pull
docker compose up -d
```

### Build from source (optional)

```bash
cd media-worker
docker compose up --build -d
```

### Logs

```bash
docker compose logs -f
```

### Stop

```bash
docker compose down
```

## 3. Manual Docker (without Compose)

```bash
cd media-worker
docker build -t hirekal/media-worker:local .
docker run --rm -p 8000:8000 --env-file .env hirekal/media-worker:local
```

## 4. Verify deployment

Health check:

```bash
curl http://localhost:8000/health
```

Expected:

```json
{"status":"healthy"}
```

Interactive API docs: `http://localhost:8000/docs`

## 5. Docker Hub image tags

CI publishes `hirekal/media-worker` on push and release:

| Event | Tags |
|-------|------|
| Push to `main` | `prod`, `prod-{sha}` |
| Push to `development` | `dev`, `dev-{sha}` |
| GitHub Release | `latest`, `vX.Y.Z`, `X.Y.Z` |

`docker-compose.yml` pins `hirekal/media-worker:prod`. To use another tag, edit the `image:` line in `docker-compose.yml`.

## 6. Environment variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `WHISPER_MODEL` | `small` | No | Faster Whisper model (`tiny`, `base`, `small`, `medium`, `large-v3`, …) |
| `LOG_LEVEL` | `INFO` | No | Logging level |
| `HOST` | `0.0.0.0` | No | Bind host (set by Docker entrypoint) |
| `PORT` | `8000` | No | Bind port (host mapping in compose uses this) |
| `DOWNLOAD_TIMEOUT_SECONDS` | `600` | No | Max seconds for video download |
| `FFMPEG_TIMEOUT_SECONDS` | `600` | No | Max seconds for audio extraction |
| `TEMP_BASE_DIR` | `/tmp/media-worker` | No | Base dir for per-request temp files |
| `STALE_TEMP_MAX_AGE_HOURS` | `6` | No | Stale temp dir max age (startup + periodic sweep) |
| `TEMP_CLEANUP_INTERVAL_HOURS` | `1` | No | Interval between stale temp sweeps |
| `TRANSCRIPT_CALLBACK_URL` | *(unset)* | No | POST full transcript JSON here after success |
| `TRANSCRIPT_CALLBACK_TIMEOUT_SECONDS` | `30` | No | Callback HTTP timeout |

If `TRANSCRIPT_CALLBACK_URL` is unset, transcription still works; no outbound callback is made.

## 7. Transcript callback

After a successful `/transcribe` request, the worker POSTs the response body to `TRANSCRIPT_CALLBACK_URL`:

```json
{
  "job_id": "job_123",
  "language": "en",
  "duration": 118.42,
  "text": "Hello my name is John...",
  "segments": [
    { "start": 0.0, "end": 2.41, "text": "Hello" }
  ]
}
```

- The original caller still receives the same JSON from `/transcribe`.
- Callback failures are logged only; they do not fail the transcription response.

## 8. Calling `/transcribe`

```bash
curl -X POST http://localhost:8000/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job_123",
    "video": {
      "url": "https://signed-cloudflare-r2-url"
    },
    "language": "auto"
  }'
```

Transcription can take around **2 minutes** depending on video length and hardware. The worker expects a pre-signed HTTPS URL (e.g. Cloudflare R2).

## 9. Temp file cleanup

- **Per request:** temp dirs are always removed in a `finally` block (success or failure).
- **Backup sweep:** on startup and every `TEMP_CLEANUP_INTERVAL_HOURS`, dirs under `TEMP_BASE_DIR` and legacy `/tmp/media-worker-*` older than `STALE_TEMP_MAX_AGE_HOURS` are deleted.

## 10. Local development (no Docker)

```bash
cd media-worker
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Requires FFmpeg on your PATH. First run downloads the Whisper model from Hugging Face (can be slow).

## 11. Wiring with HireKal API

Typical stack:

1. Start Postgres and run API migrations — see [deploy.md](../deploy.md).
2. Start the API: `cd apps/api-app && docker compose up -d`
3. Set `TRANSCRIPT_CALLBACK_URL` in `media-worker/.env` to the API webhook endpoint.
4. Start the worker: `cd media-worker && docker compose up -d`

The API exposes `POST /api/v1/media-worker-response` (public) to receive callback payloads.

# Media Worker

Standalone, stateless FastAPI service that downloads a video from a signed HTTPS URL, extracts audio with FFmpeg, transcribes it with Faster Whisper, and returns the transcript.

This service is **independent** from the NestJS backend. It has no database, authentication, queues, or business logic.

## Architecture

```text
Client (NestJS or other)
        |
        |  POST /transcribe
        v
+------------------+
|   FastAPI App    |
+------------------+
        |
        | 1. Download video (httpx stream)
        v
+------------------+
| TemporaryDirectory|
+------------------+
        |
        | 2. Extract audio (FFmpeg -> WAV mono 16kHz)
        v
+------------------+
| Faster Whisper   |  (model loaded once at startup)
+------------------+
        |
        | 3. Cleanup temp files
        v
   JSON transcript
```

## Project Structure

```text
media-worker/
├── app/
│   ├── main.py                 # FastAPI app, lifespan, exception handlers
│   ├── api/
│   │   ├── health.py           # GET /health
│   │   └── transcription.py    # POST /transcribe
│   ├── services/
│   │   ├── downloader_service.py
│   │   ├── ffmpeg_service.py
│   │   └── whisper_service.py
│   ├── schemas/
│   │   ├── request.py
│   │   └── response.py
│   ├── core/
│   │   ├── config.py
│   │   ├── logging.py
│   │   └── exceptions.py
│   └── utils/
│       └── temp_directory.py
├── Dockerfile
├── requirements.txt
└── README.md
```

## Requirements

- Python 3.9+ (macOS system `python3` works; Docker uses 3.12)
- FFmpeg (must be installed and available on `PATH`)

### No Homebrew / no Python 3.12?

Use the system Python:

```bash
python3 --version   # 3.9+ is fine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

To install Python 3.12 later without Homebrew: download the macOS installer from [python.org/downloads](https://www.python.org/downloads/).

## Installation (local)

```bash
cd media-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy environment variables:

```bash
cp .env.example .env
```

Run the service:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Docker

Build:

```bash
docker build -t hirekal/media-worker:local .
```

Run:

```bash
docker run --rm -p 8000:8000 \
  -e WHISPER_MODEL=small \
  -e LOG_LEVEL=INFO \
  hirekal/media-worker:local
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL` | `small` | Faster Whisper model name |
| `LOG_LEVEL` | `INFO` | Logging level |
| `HOST` | `0.0.0.0` | Bind host (local/dev) |
| `PORT` | `8000` | Bind port (local/dev) |
| `DOWNLOAD_TIMEOUT_SECONDS` | `600` | Max seconds for video download |
| `FFMPEG_TIMEOUT_SECONDS` | `600` | Max seconds for FFmpeg extraction |

## API

### Health

```bash
curl http://localhost:8000/health
```

Response:

```json
{
  "status": "healthy"
}
```

### Transcribe

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

Response:

```json
{
  "job_id": "job_123",
  "language": "en",
  "duration": 118.42,
  "text": "Hello my name is John...",
  "segments": [
    {
      "start": 0.0,
      "end": 2.41,
      "text": "Hello"
    },
    {
      "start": 2.41,
      "end": 5.6,
      "text": "My name is John."
    }
  ]
}
```

Interactive docs: `http://localhost:8000/docs`

## Error Responses

| Status | Meaning |
|--------|---------|
| `400` | Invalid request body |
| `404` | Unable to download file |
| `422` | Invalid or unsupported video |
| `500` | FFmpeg or Whisper failure |

Temporary files are always cleaned up, including on errors.

## Design Notes

- **Stateless**: no database, no persisted files between requests
- **Streaming download**: video is written to disk in chunks (not loaded fully into memory)
- **Single model load**: Faster Whisper model is loaded once during app startup and reused
- **Signed URLs**: the worker treats any HTTPS URL as an opaque download target (e.g. pre-signed R2 URLs)

## Extending

Future improvements (not in scope now):

- GPU / CUDA support for Whisper
- Request authentication at the edge (API gateway)
- Horizontal scaling behind a load balancer
- Metrics and tracing (Prometheus, OpenTelemetry)

## Local setup

```
cd media-worker
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
```
docker build -t hirekal/media-worker:local .
docker run --rm -p 8000:8000 hirekal/media-worker:local
```
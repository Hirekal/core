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
│   │   ├── whisper_service.py
│   │   ├── speechbrain_service.py
│   │   └── pronunciation_service.py
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
- NumPy 1.x (pinned in `requirements.txt` as `numpy>=1.26,<2`) — PyTorch 2.2.x (used by SpeechBrain in Docker) is incompatible with NumPy 2.x; without this pin, `/transcribe` may return 200 but SpeechBrain metrics fail with `RuntimeError: Numpy is not available`

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

See [deploy.md](./deploy.md) for deployment commands (Docker Compose, env vars, callback wiring, and verification).

### Docker Compose (recommended)

Compose uses `hirekal/media-worker:prod` from Docker Hub.

```bash
cp .env.example .env
docker compose pull
docker compose up -d
```

Build from source instead (optional):

```bash
docker compose up --build -d
```

After dependency changes (e.g. NumPy pin), rebuild without cache so the runtime image picks up the correct wheels:

```bash
docker compose build --no-cache
docker compose up -d
```

Compose loads env from `.env` (including optional `TRANSCRIPT_CALLBACK_URL`). Use `host.docker.internal` in callback URLs when the API runs on your host.

### Docker CLI

Build:

```bash
docker build -t hirekal/media-worker:local .
```

Run:

```bash
docker run --rm -p 8000:8000 --env-file .env hirekal/media-worker:local
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
| `TEMP_BASE_DIR` | `/tmp/media-worker` | Base directory for per-request temp workspaces |
| `STALE_TEMP_MAX_AGE_HOURS` | `6` | Delete leftover temp dirs older than this (startup + periodic sweep) |
| `TEMP_CLEANUP_INTERVAL_HOURS` | `1` | How often to run the stale temp sweep |
| `TRANSCRIPT_CALLBACK_URL` | *(unset)* | Optional URL to POST the completed transcript payload |
| `TRANSCRIPT_CALLBACK_TIMEOUT_SECONDS` | `30` | Timeout for the callback POST |
| `PRONUNCIATION_MODEL` | `facebook/wav2vec2-base-960h` | Hugging Face wav2vec2 model for English pronunciation assessment (CPU) |
| `PRONUNCIATION_ENABLED` | `true` | Enable pronunciation/prosody/fluency assessment on `/transcribe` |

## Speech analysis

Each successful `/transcribe` response can include two optional blocks:

### `speech` — timing and language (SpeechBrain + Whisper)

| Field | Source | Description |
|-------|--------|-------------|
| `language` | Whisper (primary) | Detected or requested language code |
| `language_confidence` | SpeechBrain lang-id | Confidence of SpeechBrain language classifier |
| `speech_duration`, `silence_duration`, `speech_ratio` | SpeechBrain VAD | How much of the clip is speech vs silence |
| `average_pause_duration`, `longest_pause_duration` | Derived from VAD | Pause timing |
| `speaking_rate` | Derived | Words per minute using Whisper transcript ÷ speech duration |

### `assessment` — pronunciation quality (English, CPU)

Runs when `PRONUNCIATION_ENABLED=true` and Whisper detects **English** (`en`).

| Field | Description |
|-------|-------------|
| `pronunciation_accuracy` | 0–100, IPA phoneme match between reference and wav2vec2 ASR |
| `prosody_score` | 0–100, pitch variation and energy from librosa |
| `fluency_score` | 0–100, speaking rate + pause patterns from `speech` metrics |
| `completeness_score` | 0–100, share of reference words present in Whisper transcript |
| `phonemes` | Phoneme-level feedback (`correct`, `mispronounced`, `omitted`, `inserted`) |
| `words` | Word-level feedback with per-word accuracy and nested phonemes |

**Reference text:** pass optional `reference_text` in the request body (the script the speaker was supposed to read). When omitted, the Whisper transcript is used as the reference — useful for fluency/prosody, but pronunciation accuracy is less meaningful without a known script.

**Limitations:**

- English only for `assessment` (wav2vec2-base-960h + eng-to-ipa G2P)
- Scores are heuristic (not GOPT/Kaldi-grade); suitable for feedback, not certification
- First startup downloads wav2vec2 (~360 MB) and SpeechBrain models into `/tmp`

Example request with reference script:

```bash
curl -X POST http://localhost:8000/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job_123",
    "video": { "url": "https://signed-cloudflare-r2-url" },
    "language": "en",
    "reference_text": "Hello my name is John and I am applying for this role"
  }'
```

Example assessment snippet:

```json
{
  "assessment": {
    "pronunciation_accuracy": 82.5,
    "prosody_score": 71.2,
    "fluency_score": 88.4,
    "completeness_score": 95.0,
    "reference_text": "Hello my name is John",
    "asr_transcript": "hello my name is john",
    "phonemes": [
      { "index": 0, "expected": "h", "actual": "h", "status": "correct", "score": 100.0 }
    ],
    "words": [
      {
        "word": "hello",
        "expected_ipa": "həˈloʊ",
        "actual_ipa": "həloʊ",
        "accuracy_score": 90.0,
        "status": "correct",
        "phoneme_start_index": 0,
        "phonemes": []
      }
    ]
  }
}
```

## Temp file cleanup

Each request still uses a dedicated temp directory that is **always** removed in a `finally` block when the request finishes (success or failure).

As a backup, the worker also sweeps stale temp directories on **startup** and on a **periodic interval** (not on every file arrival). It removes directories under `TEMP_BASE_DIR` and legacy `/tmp/media-worker-*` paths older than `STALE_TEMP_MAX_AGE_HOURS`.

## Transcript callback

When `TRANSCRIPT_CALLBACK_URL` is set, the worker POSTs the full `/transcribe` response body to that URL after a successful transcription:

```json
{
  "job_id": "job_123",
  "transcript": { "language": "en", "duration": 118.42, "text": "...", "segments": [] },
  "speech": { "language": "en", "speaking_rate": 145.0 },
  "assessment": { "pronunciation_accuracy": 82.5, "prosody_score": 71.2, "fluency_score": 88.4 }
}
```

The caller still receives the same JSON from `/transcribe`. Callback failures are logged but do not fail the transcription response.

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
  "transcript": {
    "language": "en",
    "duration": 118.42,
    "text": "Hello my name is John...",
    "segments": [
      { "start": 0.0, "end": 2.41, "text": "Hello" },
      { "start": 2.41, "end": 5.6, "text": "My name is John." }
    ]
  },
  "speech": {
    "language": "en",
    "language_confidence": 0.91,
    "speech_duration": 52.47,
    "silence_duration": 0.97,
    "speech_ratio": 98.18,
    "average_pause_duration": 0.49,
    "longest_pause_duration": 0.85,
    "speaking_rate": 166.95
  },
  "assessment": {
    "pronunciation_accuracy": 82.5,
    "prosody_score": 71.2,
    "fluency_score": 88.4,
    "completeness_score": 95.0,
    "reference_text": "Hello my name is John",
    "asr_transcript": "hello my name is john",
    "phonemes": [],
    "words": []
  }
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

Temporary files are always cleaned up per request (including on errors), with periodic stale-dir sweeps as a backup.

## Troubleshooting

### `RuntimeError: Numpy is not available` (SpeechBrain)

Symptoms in logs during `POST /transcribe`:

```text
RuntimeError: Failed to load audio from .../audio.wav: Numpy is not available
SpeechBrain analysis completed | ... metrics=[]
```

The HTTP response may still be **200** with a transcript, but language/VAD metrics from SpeechBrain are empty.

**Cause:** NumPy 2.x was installed alongside PyTorch 2.2.x. `torch.from_numpy()` does not work with that combination.

**Fix:**

1. Ensure `requirements.txt` includes `numpy>=1.26,<2` (already pinned in this repo).
2. Reinstall locally: `pip install -r requirements.txt`
3. Rebuild Docker: `docker compose build --no-cache && docker compose up -d`

Verify versions inside the container or venv:

```bash
python -c "import torch, numpy; print('torch', torch.__version__, 'numpy', numpy.__version__)"
```

Expect `numpy` 1.26.x (not 2.x) when using the pinned requirements.

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

## Quick reference

Local:

```bash
cd media-worker
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Docker:

```bash
docker build -t hirekal/media-worker:local .
docker run --rm -p 8000:8000 --env-file .env hirekal/media-worker:local
```
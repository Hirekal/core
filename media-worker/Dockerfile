FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# CPU-only PyTorch — single pip resolve avoids duplicate transitive wheels (e.g. filelock).
ARG TORCH_VERSION=2.2.2
ARG TORCHAUDIO_VERSION=2.2.2
ARG PYTORCH_CPU_INDEX=https://download.pytorch.org/whl/cpu

RUN pip install --upgrade pip \
    && pip wheel --wheel-dir /wheels \
        --extra-index-url ${PYTORCH_CPU_INDEX} \
        "torch==${TORCH_VERSION}" "torchaudio==${TORCHAUDIO_VERSION}" \
        -r requirements.txt


FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WHISPER_MODEL=small \
    LOG_LEVEL=INFO \
    HOST=0.0.0.0 \
    PORT=8000 \
    CUDA_VISIBLE_DEVICES="" \
    NVIDIA_VISIBLE_DEVICES=void

WORKDIR /app

ARG TORCH_VERSION=2.2.2
ARG TORCHAUDIO_VERSION=2.2.2

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --create-home --home-dir /home/app app \
    && mkdir -p /tmp/media-worker /tmp/speechbrain-models \
    && chown -R app:app /app /tmp/media-worker /tmp/speechbrain-models

COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links /wheels \
        -r requirements.txt \
        "torch==${TORCH_VERSION}" "torchaudio==${TORCHAUDIO_VERSION}" \
    && rm -rf /wheels

COPY app ./app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

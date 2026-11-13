FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV PORT=7860 \
    MAX_CONCURRENT_JOBS=3 \
    MAX_CLIP_SECONDS=180 \
    MAX_BATCH_ITEMS=15 \
    MAX_BATCH_CLIP_SECONDS=60 \
    JOB_TIMEOUT_SECONDS=120

EXPOSE 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

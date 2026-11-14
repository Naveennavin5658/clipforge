---
title: ClipForge Backend
emoji: ✂️
colorFrom: red
colorTo: zinc
sdk: docker
app_port: 7860
pinned: false
---

# ClipForge Extraction Backend

Lightweight FastAPI service using `yt-dlp --download-sections`, `ffmpeg -c copy`, and `zipstream-ng` with strict free-tier protections (`asyncio.Semaphore(3)`, 1080p cap, 180s single-clip cap, 15-item batch cap, and ephemeral `/tmp` cleanup).

## Local Run
```bash
docker build -t clipforge-backend .
docker run -p 7860:7860 -e ALLOWED_ORIGINS="*" clipforge-backend
```

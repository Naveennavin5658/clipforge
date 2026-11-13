# ClipForge

Minimalist video & playlist clipper.

- **Remote YouTube URLs & Playlists:** FastAPI + yt-dlp `--download-sections` + ffmpeg `-c copy` + streaming zipstream-ng ZIPs.
- **Local Videos:** 100% client-side trimming via ffmpeg.wasm (zero server upload).

## Quick Start

### Backend

```bash
cd backend
docker build -t clipforge-worker .
docker run --rm -p 7860:7860 clipforge-worker
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

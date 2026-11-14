# ClipForge

Zero-budget precision video clipper for local files, YouTube timestamps, and playlist batches.

- **Local Videos:** 100% client-side trimming via `@ffmpeg/ffmpeg` WebAssembly (zero server upload, zero bandwidth cost).
- **Remote YouTube URLs & Playlists:** FastAPI + `yt-dlp --download-sections` + ffmpeg fast-start stream copy + `zipstream-ng` streaming ZIPs.
- **Bot-Check Mitigation:** First-class support for Netscape `cookies.txt` and YouTube PO Tokens to bypass 403 bot challenges.
- **Edge Gateway:** Cloudflare Worker + Upstash Redis rate limiter, metadata cache, and deduplication proxy.

---

## Project Structure

```text
ClipForge/
├── frontend/        # React 19 + TypeScript + Tailwind CSS v4 + @ffmpeg/wasm
├── backend/         # Python FastAPI + yt-dlp + ffmpeg + zipstream-ng
├── edge-gateway/    # Cloudflare Worker proxy with Upstash Redis rate limiting
├── deploy/          # Oracle Cloud Always Free VM (Docker Compose + Caddy SSL)
└── DEPLOYMENT.md    # Complete $0 Free-Tier deployment guide
```

---

## Quick Start

### 1. Backend (FastAPI + yt-dlp)

```bash
cd backend
# Local Python venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 7860

# Or via Docker
docker build -t clipforge-backend .
docker run --rm -p 7860:7860 clipforge-backend
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` (or `http://localhost:5173`). Configure the backend endpoint in the UI header or via `.env` (`VITE_API_BASE_URL`).

### 3. Edge Gateway (Optional Cloudflare Worker)

```bash
cd edge-gateway
npm install
npm run dev
```

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions on deploying ClipForge on free tiers:
- **Backend:** Hugging Face Spaces (Docker SDK) or Oracle Cloud Always Free VM
- **Edge Gateway:** Cloudflare Workers + Upstash Redis
- **Frontend:** Vercel or Cloudflare Pages

# ClipForge Stage 1 Deployment Guide ($0 Free Tier)

## 1. Backend Docker (Choose One)

### Option A: Hugging Face Spaces (Fastest, Zero Server Admin)
1. Create a new Space on Hugging Face with **SDK = Docker** (Blank).
2. Push the `backend/` folder contents (`Dockerfile`, `main.py`, `requirements.txt`, `README.md`) to the Space repo.
3. Wait for build to turn `Running`. Your backend URL will be:
   `https://<username>-<space-name>.hf.space`

### Option B: Oracle Cloud Always Free VM (Better IP Reputation for YouTube)
1. Provision an Ampere ARM or AMD Free-Tier Ubuntu VM and open ports `80` and `443` in your VCN Security List + `ufw`.
2. Update `deploy/Caddyfile` with your domain pointing to the VM's public IP.
3. Run:
   ```bash
   docker compose -f deploy/oracle-compose.yml up -d --build
   ```

---

## 2. Edge Gateway (Cloudflare Workers + Upstash Redis)
1. Create a free Redis database at **Upstash** and copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
2. Edit `edge-gateway/wrangler.toml` and set `BACKEND_ORIGIN` to your HF Space or Oracle Caddy URL.
3. Deploy:
   ```bash
   cd edge-gateway
   npm install
   npx wrangler secret put UPSTASH_REDIS_REST_URL
   npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
   npm run deploy
   ```
4. Copy the deployed Worker URL (`https://clipforge-edge-gateway.<subdomain>.workers.dev`).

---

## 3. Frontend (Vercel or Cloudflare Pages)
1. Set environment variable `VITE_API_BASE_URL` to your Cloudflare Worker URL or backend URL.
2. **Vercel:** Connect repo -> Set Root Directory to `frontend` -> Framework Preset `Vite` -> Build `npm run build` -> Output `dist` (`vercel.json` handles SPA routing).
3. **Cloudflare Pages:** Connect repo -> Set Root Directory to `frontend` -> Build `npm run build` -> Output `dist` (`public/_headers` applies security headers).

export function StageOneArchitecture() {
  return (
    <div className="space-y-12 pt-4">
      <section id="edge-gateway" className="border-t border-zinc-200 pt-10">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-2">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-950">
              01. Edge Gateway &amp; Free-Tier Survival
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600">
              A Cloudflare Worker + Upstash Redis layer sits ahead of the Docker backend so a single burst never saturates
              the 3 extraction slots.
            </p>
          </div>

          <div className="lg:col-span-8 grid gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-1.5">
              <p className="font-mono text-xs tabular-nums text-zinc-500">12 clips / 10 min</p>
              <h3 className="text-sm font-semibold text-zinc-950">Per-IP Rate Limiting</h3>
              <p className="text-xs leading-relaxed text-zinc-600">
                Atomic <span className="font-mono">INCR + EXPIRE</span> counters in Upstash Redis return clean{' '}
                <span className="font-mono">429</span> responses with <span className="font-mono">Retry-After</span>.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-1.5">
              <p className="font-mono text-xs tabular-nums text-zinc-500">900s TTL</p>
              <h3 className="text-sm font-semibold text-zinc-950">Playlist Meta Cache</h3>
              <p className="text-xs leading-relaxed text-zinc-600">
                Caches <span className="font-mono">/playlist-meta</span> JSON by list ID so repeat lookups avoid spawning{' '}
                <span className="font-mono">yt-dlp</span>.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-1.5">
              <p className="font-mono text-xs tabular-nums text-zinc-500">NX Lock · 120s</p>
              <h3 className="text-sm font-semibold text-zinc-950">Clip Deduplication</h3>
              <p className="text-xs leading-relaxed text-zinc-600">
                Guards <span className="font-mono">(video_id, start, end)</span> keys in-flight so duplicate clicks never
                burn two backend workers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="bot-resilience" className="border-t border-zinc-200 pt-10">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-2">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-950">
              02. YouTube 403 &amp; Bot-Check Resilience
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600">
              Cloud datacenter IPs trigger occasional YouTube bot challenges. ClipForge classifies them cleanly instead
              of surfacing raw stack traces.
            </p>
          </div>

          <div className="lg:col-span-8 rounded-xl border border-zinc-200 bg-white p-6">
            <div className="grid gap-6 sm:grid-cols-2 text-xs leading-relaxed text-zinc-600">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-zinc-950">Structured Error Recovery</h3>
                <p>
                  Detects <span className="font-mono">HTTP 403</span>, bot verification prompts, and PO token errors from{' '}
                  <span className="font-mono">yt-dlp</span> stderr and directs users to the one-click Bot-Check Bypass
                  panel or Local File mode.
                </p>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-zinc-950">Zero-Persistence Credentials</h3>
                <p>
                  Optional <span className="font-mono">cookies.txt</span> and <span className="font-mono">PO Token</span>{' '}
                  inputs are written to a <span className="font-mono">0600</span> ephemeral temp file for that single
                  command and deleted immediately in <span className="font-mono">finally</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="deployment" className="border-t border-zinc-200 pt-10">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-2">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-950">
              03. Stage 1 Deployment Stack
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600">
              Ready-to-ship configs are included in the repository for $0 free-tier hosting across frontend, edge, and
              Docker extraction.
            </p>
          </div>

          <div className="lg:col-span-8 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Layer</th>
                  <th className="px-4 py-3 font-medium">Free-Tier Host</th>
                  <th className="px-5 py-3 font-medium">Config File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                <tr>
                  <td className="px-5 py-3 font-medium text-zinc-950">Frontend Studio</td>
                  <td className="px-4 py-3">Vercel or Cloudflare Pages</td>
                  <td className="px-5 py-3 font-mono">vercel.json · public/_headers</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-medium text-zinc-950">Edge Rate Limit &amp; Cache</td>
                  <td className="px-4 py-3">Cloudflare Workers + Upstash Redis</td>
                  <td className="px-5 py-3 font-mono">edge-gateway/wrangler.toml</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-medium text-zinc-950">Docker Backend (FastAPI)</td>
                  <td className="px-4 py-3">Hugging Face Spaces or Oracle Cloud</td>
                  <td className="px-5 py-3 font-mono">backend/Dockerfile · deploy/oracle-compose.yml</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

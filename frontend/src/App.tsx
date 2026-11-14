import { useMemo, useState } from 'react';
import { Sparkles, Film, FileVideo, Layers, HelpCircle, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { ForgeStatsBanner } from './components/ForgeStatsBanner';
import { UniversalInput } from './components/UniversalInput';
import { BotBypassPanel } from './components/BotBypassPanel';
import { SingleClipper } from './components/SingleClipper';
import { PlaylistBatcher } from './components/PlaylistBatcher';
import { BackendConfigModal } from './components/BackendConfigModal';
import { StageOneArchitecture } from './components/StageOneArchitecture';
import { Logo } from './components/Logo';
import { detectInputSource, type BotBypassCredentials } from './lib/clipforge';
import { generateSyntheticLocalVideo } from './utils/localFfmpeg';

const DEFAULT_API_BASE =
  (typeof window !== 'undefined' && window.localStorage.getItem('clipforge_api_base')) ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8000';

export default function App() {
  const [urlInput, setUrlInput] = useState('');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [generatingSample, setGeneratingSample] = useState(false);

  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE);
  const [configOpen, setConfigOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);

  const [botBypassOpen, setBotBypassOpen] = useState(false);
  const [botBypass, setBotBypass] = useState<BotBypassCredentials>({ cookiesTxt: '', poToken: '' });

  const detected = useMemo(() => {
    if (localFile) {
      return { mode: 'local' as const, videoId: null, listId: null, canonicalUrl: null };
    }
    return detectInputSource(urlInput);
  }, [localFile, urlInput]);

  const handleSaveApiBase = (nextUrl: string) => {
    setApiBaseUrl(nextUrl);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('clipforge_api_base', nextUrl);
    }
  };

  const handleUrlChange = (val: string) => {
    setLocalFile(null);
    setUrlInput(val);
  };

  const handleFileSelected = (file: File) => {
    setUrlInput('');
    setLocalFile(file);
  };

  const handleClear = () => {
    setUrlInput('');
    setLocalFile(null);
  };

  const handleGenerateLocalSample = async () => {
    setGeneratingSample(true);
    try {
      const sampleFile = await generateSyntheticLocalVideo();
      handleFileSelected(sampleFile);
    } finally {
      setGeneratingSample(false);
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#0b0c14] text-zinc-100 font-sans selection:bg-orange-500 selection:text-white relative overflow-hidden">
      {/* Ambient Forge Glow in Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-orange-600/15 via-rose-600/10 to-transparent blur-[120px] pointer-events-none" />

      {/* Live Animated Forge Ticker Flex Banner */}
      <ForgeStatsBanner apiBaseUrl={apiBaseUrl} triggerCelebration={celebrationKey} />

      <Header
        onOpenConfig={() => setConfigOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        apiBaseUrl={apiBaseUrl}
      />

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* Creative Cinematic Hero */}
        <section className="text-center max-w-2xl mx-auto space-y-4 pt-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3.5 py-1 text-xs font-mono font-bold text-orange-400 shadow-[0_0_15px_rgba(255,107,0,0.15)] backdrop-blur-xs"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-ping" />
            <span>PRECISE VIDEO SECTION CLIPPER</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.1]"
          >
            Cut the gold. <br />
            <span className="bg-gradient-to-r from-orange-400 via-rose-500 to-amber-300 bg-clip-text text-transparent">
              Forget the rest.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-xl mx-auto"
          >
            Don't download a 2-hour video just for a 15-second snippet. Paste any YouTube link or drop a video file, set your in/out points, and forge your clip.
          </motion.p>
        </section>

        {/* Workspace Stage */}
        <section id="workspace" className="space-y-6">
          <UniversalInput
            urlValue={urlInput}
            detectedMode={detected.mode}
            validationError={detected.error}
            localFileName={localFile?.name || null}
            onUrlChange={handleUrlChange}
            onFileSelected={handleFileSelected}
            onClear={handleClear}
            onLoadSampleYoutube={() => handleUrlChange('https://www.youtube.com/watch?v=jNQXAC9IVRw')}
            onLoadSamplePlaylist={() =>
              handleUrlChange('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
            }
            onGenerateLocalSample={handleGenerateLocalSample}
            generatingSample={generatingSample}
          />

          {/* Protected Video Settings (Only for YouTube links) */}
          {(detected.mode === 'youtube-single' || detected.mode === 'youtube-playlist') && (
            <BotBypassPanel
              open={botBypassOpen}
              onToggle={() => setBotBypassOpen((v) => !v)}
              credentials={botBypass}
              onChange={setBotBypass}
            />
          )}

          {/* Single Video Clipper (YouTube or Local File) */}
          {(detected.mode === 'local' || detected.mode === 'youtube-single') && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <SingleClipper
                mode={detected.mode}
                localFile={localFile}
                videoId={detected.videoId}
                canonicalUrl={detected.canonicalUrl}
                apiBaseUrl={apiBaseUrl}
                botBypass={botBypass}
                onRequestOpenBotBypass={() => setBotBypassOpen(true)}
                onClipForged={() => setCelebrationKey((k) => k + 1)}
              />
            </motion.div>
          )}

          {/* Playlist Batcher */}
          {detected.mode === 'youtube-playlist' && detected.canonicalUrl && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <PlaylistBatcher
                canonicalUrl={detected.canonicalUrl}
                listId={detected.listId}
                apiBaseUrl={apiBaseUrl}
                botBypass={botBypass}
                onRequestOpenBotBypass={() => setBotBypassOpen(true)}
                onClipForged={(count) => setCelebrationKey((k) => k + count)}
              />
            </motion.div>
          )}

          {/* Clean Initial Mode Explainer Grid when no video loaded */}
          {(detected.mode === 'empty' || detected.mode === 'invalid') && (
            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <div className="rounded-3xl border border-[#23283c] bg-[#121420] p-6 shadow-xl space-y-3 hover:border-orange-500/40 transition-colors">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                  <Film className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-white">
                  Snip YouTube Links
                </h3>
                <p className="text-xs leading-relaxed text-zinc-400">
                  Paste any YouTube video or Shorts link. Pick the start and end timestamp with precision, and download in 1080p MP4.
                </p>
              </div>

              <div className="rounded-3xl border border-[#23283c] bg-[#121420] p-6 shadow-xl space-y-3 hover:border-blue-500/40 transition-colors">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <FileVideo className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-white">
                  Trim Local Videos Fast
                </h3>
                <p className="text-xs leading-relaxed text-zinc-400">
                  Cut screen captures, raw camera files, or memes directly on your machine. 100% private with WebAssembly.
                </p>
              </div>

              <div className="rounded-3xl border border-[#23283c] bg-[#121420] p-6 shadow-xl space-y-3 hover:border-purple-500/40 transition-colors">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-white">
                  Batch Playlist Highlights
                </h3>
                <p className="text-xs leading-relaxed text-zinc-400">
                  Paste a playlist link, pick multiple video segments, and download all clips together in a single ZIP package.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* The Creator Reel Showcase */}
        <StageOneArchitecture />
      </main>

      {/* Cinematic Studio Footer */}
      <footer className="border-t border-[#1f2438] bg-[#0c0e18] py-8 text-xs text-zinc-500 relative z-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" withText={false} animated={false} />
            <span className="font-display font-bold text-zinc-300">ClipForge</span>
            <span className="text-zinc-600">/</span>
            <span className="font-mono text-[11px] text-zinc-500">PRECISION MEDIA FORGE</span>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Server settings
            </button>
          </div>
        </div>
      </footer>

      {/* Backend Settings Dialog */}
      <BackendConfigModal
        open={configOpen}
        apiBaseUrl={apiBaseUrl}
        onSave={handleSaveApiBase}
        onClose={() => setConfigOpen(false)}
      />

      {/* How It Works Help Dialog */}
      <AnimatePresence>
        {helpOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl border border-[#252b42] bg-[#121422] p-6 sm:p-7 shadow-2xl space-y-6 text-white"
            >
              <div className="flex items-center justify-between border-b border-[#202538] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="help-modal-title" className="font-display text-lg font-bold text-white">
                      How ClipForge Works
                    </h2>
                    <p className="text-xs text-zinc-400">Simple 3-step guide</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  aria-label="Close dialog"
                  className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-zinc-300">
                <div className="flex items-start gap-3 rounded-2xl bg-[#161a2b] border border-[#22283d] p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-black font-extrabold text-xs">
                    1
                  </span>
                  <div>
                    <p className="font-bold text-white">Choose your video</p>
                    <p className="mt-0.5 leading-relaxed text-zinc-400">
                      Paste any public YouTube link, or choose a video file from your computer.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-[#161a2b] border border-[#22283d] p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-black font-extrabold text-xs">
                    2
                  </span>
                  <div>
                    <p className="font-bold text-white">Pick your moment on the 35mm timeline</p>
                    <p className="mt-0.5 leading-relaxed text-zinc-400">
                      Use the quick preset chips (15s, 30s, 60s) or slide the magnetic clamps to the exact second.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-[#161a2b] border border-[#22283d] p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-black font-extrabold text-xs">
                    3
                  </span>
                  <div>
                    <p className="font-bold text-white">Forge and download</p>
                    <p className="mt-0.5 leading-relaxed text-zinc-400">
                      Click Forge Clip. ClipForge cuts just that section and saves the crisp MP4 to your downloads folder.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="w-full rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 py-3 text-xs font-bold text-white shadow-lg shadow-orange-600/20 transition-all"
              >
                Got it, let's clip!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

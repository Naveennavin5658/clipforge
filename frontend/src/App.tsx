import { useMemo, useState } from 'react';
import { Scissors, Sparkles, Film, FileVideo, Layers, HelpCircle, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { UniversalInput } from './components/UniversalInput';
import { BotBypassPanel } from './components/BotBypassPanel';
import { SingleClipper } from './components/SingleClipper';
import { PlaylistBatcher } from './components/PlaylistBatcher';
import { BackendConfigModal } from './components/BackendConfigModal';
import { StageOneArchitecture } from './components/StageOneArchitecture';
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
    <div id="top" className="min-h-screen flex flex-col bg-gradient-to-b from-rose-50/20 via-zinc-50 to-white text-zinc-950 font-sans selection:bg-rose-500 selection:text-white">
      <Header
        onOpenConfig={() => setConfigOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        apiBaseUrl={apiBaseUrl}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-10 space-y-10">
        {/* Expressive Hero */}
        <section className="text-center max-w-2xl mx-auto space-y-4 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200/80 bg-rose-50/80 px-3.5 py-1 text-xs font-semibold text-rose-700 shadow-xs backdrop-blur-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-rose-500" />
            <span>Fast, free &amp; no watermarks</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950 leading-[1.15]"
          >
            Cut the moment. <br />
            <span className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 bg-clip-text text-transparent">
              Skip the rest.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-base sm:text-lg text-zinc-600 leading-relaxed"
          >
            Paste any YouTube link or drop a video file. Grab exactly the snippet you want in seconds — no multi-gigabyte downloads.
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

          {/* Protected Video Settings (Only shown for YouTube links) */}
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
              initial={{ opacity: 0, y: 12 }}
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
              />
            </motion.div>
          )}

          {/* Playlist Batcher */}
          {detected.mode === 'youtube-playlist' && detected.canonicalUrl && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <PlaylistBatcher
                canonicalUrl={detected.canonicalUrl}
                listId={detected.listId}
                apiBaseUrl={apiBaseUrl}
                botBypass={botBypass}
                onRequestOpenBotBypass={() => setBotBypassOpen(true)}
              />
            </motion.div>
          )}

          {/* Friendly Guidance Cards when nothing is loaded yet */}
          {(detected.mode === 'empty' || detected.mode === 'invalid') && (
            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-xs space-y-2.5 transition-all hover:border-zinc-300">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <Film className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-zinc-950">
                  Cut Any YouTube Video
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600">
                  Just paste a video or Shorts link. Pick the start and end moments, and download an HD MP4 snippet in seconds.
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-xs space-y-2.5 transition-all hover:border-zinc-300">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                  <FileVideo className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-zinc-950">
                  Trim Local Videos Fast
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600">
                  Got a phone video or screen recording? Drop it here to cut it right in your browser. Completely private, zero upload.
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-xs space-y-2.5 transition-all hover:border-zinc-300">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-zinc-950">
                  Batch Playlist Highlights
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600">
                  Paste a playlist link, pick multiple video clips, and download them all together in a single convenient ZIP file.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Value Proposition & Collapsed Developer Details */}
        <StageOneArchitecture />
      </main>

      {/* Clean, Non-intrusive Footer */}
      <footer className="border-t border-zinc-200/80 bg-white/70 backdrop-blur-xs py-6 text-xs text-zinc-500">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-zinc-800">ClipForge</span>
            <span>— The precision video clipper</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="text-zinc-600 hover:text-zinc-950 transition-colors"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              className="text-zinc-600 hover:text-zinc-950 transition-colors"
            >
              Server settings
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="help-modal-title" className="font-display text-lg font-bold text-zinc-950">
                      How ClipForge Works
                    </h2>
                    <p className="text-xs text-zinc-500">Simple 3-step guide</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  aria-label="Close dialog"
                  className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-zinc-600">
                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-xs">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-900">Choose your video</p>
                    <p className="mt-0.5 leading-relaxed">
                      Paste any public YouTube link, or choose a video file from your computer.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-xs">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-900">Pick your favorite moment</p>
                    <p className="mt-0.5 leading-relaxed">
                      Use the quick preset buttons (15s, 30s, 60s) or adjust the start and end times to the exact second.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-xs">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-900">Save and share!</p>
                    <p className="mt-0.5 leading-relaxed">
                      Click Download Clip. ClipForge cuts just that snippet and saves it to your downloads folder.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="w-full rounded-2xl bg-zinc-950 py-3 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shadow-sm"
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

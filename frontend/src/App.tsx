import { useMemo, useState } from 'react';
import { Scissors, HardDrive, Layers } from 'lucide-react';
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
    <div id="top" className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      <Header onOpenConfig={() => setConfigOpen(true)} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 space-y-8">
        {/* Hero */}
        <section className="max-w-3xl space-y-3">
          <h1
            style={{ textWrap: 'balance' }}
            className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950"
          >
            Extract exact video clips without downloading gigabytes.
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-zinc-600">
            Drop a local video to stream-copy in your browser with zero upload, or paste a YouTube URL or playlist to
            fetch only the timestamped section you need.
          </p>
        </section>

        {/* Workspace */}
        <section id="workspace" className="space-y-4">
          <UniversalInput
            urlValue={urlInput}
            detectedMode={detected.mode}
            validationError={detected.error}
            localFileName={localFile?.name || null}
            onUrlChange={handleUrlChange}
            onFileSelected={handleFileSelected}
            onClear={handleClear}
            onLoadSampleYoutube={() => handleUrlChange('https://www.youtube.com/watch?v=aqz-KE-bpKQ')}
            onLoadSamplePlaylist={() =>
              handleUrlChange('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
            }
            onGenerateLocalSample={handleGenerateLocalSample}
            generatingSample={generatingSample}
          />

          {(detected.mode === 'youtube-single' || detected.mode === 'youtube-playlist') && (
            <BotBypassPanel
              open={botBypassOpen}
              onToggle={() => setBotBypassOpen((v) => !v)}
              credentials={botBypass}
              onChange={setBotBypass}
            />
          )}

          {(detected.mode === 'local' || detected.mode === 'youtube-single') && (
            <SingleClipper
              mode={detected.mode}
              localFile={localFile}
              videoId={detected.videoId}
              canonicalUrl={detected.canonicalUrl}
              apiBaseUrl={apiBaseUrl}
              botBypass={botBypass}
              onRequestOpenBotBypass={() => setBotBypassOpen(true)}
            />
          )}

          {detected.mode === 'youtube-playlist' && detected.canonicalUrl && (
            <PlaylistBatcher
              canonicalUrl={detected.canonicalUrl}
              listId={detected.listId}
              apiBaseUrl={apiBaseUrl}
              botBypass={botBypass}
              onRequestOpenBotBypass={() => setBotBypassOpen(true)}
            />
          )}

          {(detected.mode === 'empty' || detected.mode === 'invalid') && (
            <div className="grid gap-4 md:grid-cols-3 pt-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-2">
                <HardDrive className="h-4 w-4 text-zinc-700" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-zinc-950">Local Video Mode</h2>
                <p className="text-xs leading-relaxed text-zinc-600">
                  Trims MP4, MOV, and WebM files inside your browser via <span className="font-mono">ffmpeg.wasm</span>{' '}
                  (<span className="font-mono">-c copy</span>). Zero upload, zero server load.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-2">
                <Scissors className="h-4 w-4 text-zinc-700" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-zinc-950">Single YouTube Clip</h2>
                <p className="text-xs leading-relaxed text-zinc-600">
                  Fetches only the requested timestamp window via{' '}
                  <span className="font-mono">--download-sections</span>. Capped at 1080p and 180s to stay on $0 free
                  tiers.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-2">
                <Layers className="h-4 w-4 text-zinc-700" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-zinc-950">Playlist Batch ZIP</h2>
                <p className="text-xs leading-relaxed text-zinc-600">
                  Select up to 15 clips (60s max each) and stream a single <span className="font-mono">ZIP_STORED</span>{' '}
                  archive without storing files on disk.
                </p>
              </div>
            </div>
          )}
        </section>

        <StageOneArchitecture />
      </main>

      <footer className="border-t border-zinc-200 bg-white py-6 text-xs text-zinc-500">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <span>ClipForge — Split-brain precision clipper</span>
          <span className="font-mono">Endpoint: {apiBaseUrl || 'Not configured'}</span>
        </div>
      </footer>

      <BackendConfigModal
        open={configOpen}
        apiBaseUrl={apiBaseUrl}
        onSave={handleSaveApiBase}
        onClose={() => setConfigOpen(false)}
      />
    </div>
  );
}

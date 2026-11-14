import { useRef, useState } from 'react';
import { Upload, Link2, X } from 'lucide-react';
import type { InputMode } from '../lib/clipforge';

interface UniversalInputProps {
  urlValue: string;
  detectedMode: InputMode;
  validationError?: string;
  localFileName: string | null;
  onUrlChange: (value: string) => void;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  onLoadSampleYoutube: () => void;
  onLoadSamplePlaylist: () => void;
  onGenerateLocalSample: () => void;
  generatingSample: boolean;
}

export function UniversalInput({
  urlValue,
  detectedMode,
  validationError,
  localFileName,
  onUrlChange,
  onFileSelected,
  onClear,
  onLoadSampleYoutube,
  onLoadSamplePlaylist,
  onGenerateLocalSample,
  generatingSample,
}: UniversalInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      onFileSelected(dropped);
    }
  };

  const modeLabel =
    detectedMode === 'local'
      ? 'Local File (Browser ffmpeg.wasm)'
      : detectedMode === 'youtube-single'
        ? 'Single YouTube Video'
        : detectedMode === 'youtube-playlist'
          ? 'YouTube Playlist Batch'
          : detectedMode === 'invalid'
            ? 'Unrecognized URL'
            : 'Auto-detects YouTube URL, Playlist, or Local Video';

  return (
    <section aria-label="Universal source input" className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border bg-white p-4 transition-colors ${
          dragging ? 'border-rose-600 bg-rose-50/40' : 'border-zinc-200'
        }`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <label htmlFor="universal-source-input" className="sr-only">
              YouTube video URL, playlist URL, or local video file
            </label>
            <Link2
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            />
            <input
              id="universal-source-input"
              type="text"
              value={localFileName ? `Local file: ${localFileName}` : urlValue}
              readOnly={Boolean(localFileName)}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="Paste a YouTube video or playlist URL, or drop a local video file..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-3 pl-10 pr-10 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
            />
            {(urlValue || localFileName) && (
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear source input"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mkv,.mov,.mp4,.webm"
              tabIndex={-1}
              aria-hidden="true"
              className="hidden"
              id="local-video-picker"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelected(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
            >
              <Upload className="h-4 w-4 text-zinc-500" />
              Choose Video File
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className={detectedMode === 'invalid' ? 'font-medium text-rose-600' : 'font-medium text-zinc-700'}>
              {modeLabel}
            </span>
            {validationError && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-rose-600">{validationError}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onLoadSampleYoutube}
              className="text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 whitespace-nowrap shrink-0"
            >
              Sample YouTube video
            </button>
            <button
              type="button"
              onClick={onLoadSamplePlaylist}
              className="text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 whitespace-nowrap shrink-0"
            >
              Sample playlist
            </button>
            <button
              type="button"
              disabled={generatingSample}
              onClick={onGenerateLocalSample}
              className="text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {generatingSample ? 'Generating 4.5s clip...' : 'Generate local test clip'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

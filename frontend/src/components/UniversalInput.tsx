import { useRef, useState } from 'react';
import { Upload, Link2, X, Clipboard, Film, FileVideo, ListVideo, Sparkles, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [activeTab, setActiveTab] = useState<'link' | 'file'>(localFileName ? 'file' : 'link');

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setActiveTab('file');
      onFileSelected(dropped);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setActiveTab('link');
        onUrlChange(text.trim());
      }
    } catch {
      // Fallback: focus input so user can Cmd+V
      document.getElementById('universal-source-input')?.focus();
    }
  };

  const isYoutube = detectedMode === 'youtube-single';
  const isPlaylist = detectedMode === 'youtube-playlist';
  const isLocal = detectedMode === 'local';

  return (
    <section aria-label="Choose video source" className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex items-center justify-center gap-2">
        <div className="inline-flex rounded-2xl bg-zinc-200/60 p-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => {
              setActiveTab('link');
              if (localFileName) onClear();
            }}
            className={`relative flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'link' ? 'text-zinc-950 shadow-sm' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            {activeTab === 'link' && (
              <motion.div
                layoutId="activeTabBadge"
                className="absolute inset-0 rounded-xl bg-white"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Film className="h-4 w-4 text-rose-500" />
              Paste Video or Playlist Link
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('file');
              if (urlValue) onClear();
            }}
            className={`relative flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'file' ? 'text-zinc-950 shadow-sm' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            {activeTab === 'file' && (
              <motion.div
                layoutId="activeTabBadge"
                className="absolute inset-0 rounded-xl bg-white"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <FileVideo className="h-4 w-4 text-blue-500" />
              Trim File on My Computer
            </span>
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-3xl border bg-white p-5 sm:p-7 shadow-sm transition-all duration-200 ${
          dragging
            ? 'border-rose-500 ring-4 ring-rose-500/10 bg-rose-50/30'
            : 'border-zinc-200/80 hover:border-zinc-300'
        }`}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'link' ? (
            <motion.div
              key="tab-link"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="relative flex flex-col sm:flex-row items-stretch gap-2.5">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <input
                    id="universal-source-input"
                    type="url"
                    value={urlValue}
                    onChange={(e) => onUrlChange(e.target.value)}
                    placeholder="Paste a YouTube video or playlist link (e.g. youtube.com/watch?v=...)"
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 py-3.5 pl-11 pr-24 text-sm sm:text-base text-zinc-950 placeholder:text-zinc-400 transition-all focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-rose-500/10"
                  />
                  {urlValue ? (
                    <button
                      type="button"
                      onClick={onClear}
                      aria-label="Clear link"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 shadow-sm border border-zinc-200/80 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                    >
                      <Clipboard className="h-3.5 w-3.5 text-zinc-400" />
                      Paste
                    </button>
                  )}
                </div>
              </div>

              {/* Status or Detection Pill */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  {isYoutube && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 border border-emerald-200">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                      YouTube video ready to clip
                    </span>
                  )}
                  {isPlaylist && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 font-medium text-purple-700 border border-purple-200">
                      <ListVideo className="h-3.5 w-3.5 text-purple-600" />
                      YouTube playlist detected — select multiple clips
                    </span>
                  )}
                  {detectedMode === 'invalid' && validationError && (
                    <span className="font-medium text-rose-600">{validationError}</span>
                  )}
                  {detectedMode === 'empty' && (
                    <span className="text-zinc-500 font-medium">
                      Paste any public YouTube video, Short, or Playlist URL
                    </span>
                  )}
                </div>

                {/* Example Quick-Pick Chips */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-medium hidden sm:inline">Try an example:</span>
                  <button
                    type="button"
                    onClick={onLoadSampleYoutube}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 hover:bg-rose-50 hover:text-rose-700 px-3 py-1 text-zinc-600 font-medium transition-colors"
                  >
                    🐱 Fun short clip
                  </button>
                  <button
                    type="button"
                    onClick={onLoadSamplePlaylist}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 hover:bg-purple-50 hover:text-purple-700 px-3 py-1 text-zinc-600 font-medium transition-colors"
                  >
                    🎵 Chill playlist
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="tab-file"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mkv,.mov,.mp4,.webm"
                className="hidden"
                id="local-video-picker"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelected(file);
                  e.target.value = '';
                }}
              />

              {localFileName ? (
                <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                      <Film className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-950 truncate max-w-xs sm:max-w-md">
                        {localFileName}
                      </p>
                      <p className="text-xs text-blue-700 font-medium">
                        Ready to trim • 100% private on your device
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 shadow-sm transition-colors"
                    >
                      Change file
                    </button>
                    <button
                      type="button"
                      onClick={onClear}
                      aria-label="Remove file"
                      className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-800 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 hover:border-blue-500/80 bg-zinc-50/50 hover:bg-blue-50/20 px-6 py-8 text-center cursor-pointer transition-all"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, y: -2 }}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm mb-3"
                  >
                    <Upload className="h-6 w-6" />
                  </motion.div>
                  <p className="text-sm sm:text-base font-semibold text-zinc-900">
                    Click to choose a video, or drag and drop it here
                  </p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                    Supports MP4, MOV, WebM, and MKV. Trimming happens right in your browser without uploading to the cloud.
                  </p>
                </div>
              )}

              {/* Sample Generator for File Mode */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-t border-zinc-100 pt-3">
                <span className="text-zinc-500">
                  🔒 Zero server upload — your videos never leave your computer
                </span>
                <button
                  type="button"
                  disabled={generatingSample}
                  onClick={onGenerateLocalSample}
                  className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {generatingSample ? 'Creating test video...' : 'Generate 5s sample test video'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

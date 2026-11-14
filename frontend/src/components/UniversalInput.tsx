import { useRef, useState } from 'react';
import { Upload, Link2, X, Clipboard, Film, FileVideo, ListVideo, Sparkles, CheckCircle2 } from 'lucide-react';
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
      document.getElementById('universal-source-input')?.focus();
    }
  };

  const isYoutube = detectedMode === 'youtube-single';
  const isPlaylist = detectedMode === 'youtube-playlist';

  return (
    <section aria-label="Choose video source" className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex items-center justify-center gap-2">
        <div className="inline-flex rounded-2xl bg-[#141724] border border-[#23283c] p-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveTab('link');
              if (localFileName) onClear();
            }}
            className={`relative flex items-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'link' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === 'link' && (
              <motion.div
                layoutId="activeTabBadge"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-600/90 to-rose-600/90 shadow-md"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Film className="h-4 w-4 text-orange-200" />
              YouTube Video or Playlist
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('file');
              if (urlValue) onClear();
            }}
            className={`relative flex items-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-semibold transition-colors ${
              activeTab === 'file' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {activeTab === 'file' && (
              <motion.div
                layoutId="activeTabBadge"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/90 to-indigo-600/90 shadow-md"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <FileVideo className="h-4 w-4 text-blue-200" />
              Trim Local File (Offline)
            </span>
          </button>
        </div>
      </div>

      {/* Main Deck Container */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-3xl border bg-[#11131e] p-5 sm:p-7 shadow-2xl transition-all duration-200 ${
          dragging
            ? 'border-orange-500 ring-4 ring-orange-500/20 bg-orange-950/20'
            : 'border-[#22283d] hover:border-[#2f3652]'
        }`}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'link' ? (
            <motion.div
              key="tab-link"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Link2 className="h-5 w-5" />
                </div>
                <input
                  id="universal-source-input"
                  type="url"
                  value={urlValue}
                  onChange={(e) => onUrlChange(e.target.value)}
                  placeholder="Paste YouTube link (video, Shorts, or full playlist)..."
                  className="w-full rounded-2xl border border-[#2a3047] bg-[#0c0d16] py-4 pl-12 pr-24 text-sm sm:text-base font-medium text-white placeholder:text-zinc-500 transition-all focus:border-orange-500 focus:bg-black focus:outline-none focus:ring-4 focus:ring-orange-500/15"
                />
                {urlValue ? (
                  <button
                    type="button"
                    onClick={onClear}
                    aria-label="Clear link"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-xl bg-[#1c2133] hover:bg-[#262c45] border border-zinc-700/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors shadow-sm"
                  >
                    <Clipboard className="h-3.5 w-3.5 text-orange-400" />
                    Paste Link
                  </button>
                )}
              </div>

              {/* Status and Example Chips */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  {isYoutube && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      YouTube video ready for cutting
                    </span>
                  )}
                  {isPlaylist && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 font-semibold text-purple-400">
                      <ListVideo className="h-3.5 w-3.5" />
                      Playlist detected — batch selection active
                    </span>
                  )}
                  {detectedMode === 'invalid' && validationError && (
                    <span className="font-semibold text-rose-400">{validationError}</span>
                  )}
                  {detectedMode === 'empty' && (
                    <span className="text-zinc-500 font-mono text-[11px]">
                      READY TO EXTRACT PRECISE SECTIONS
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-medium hidden sm:inline">Try examples:</span>
                  <button
                    type="button"
                    onClick={onLoadSampleYoutube}
                    className="rounded-full bg-[#181c2e] hover:bg-orange-500/20 hover:text-orange-300 border border-[#2b324d] px-3 py-1 text-zinc-300 font-medium transition-colors"
                  >
                    🐱 Fun 19s Video
                  </button>
                  <button
                    type="button"
                    onClick={onLoadSamplePlaylist}
                    className="rounded-full bg-[#181c2e] hover:bg-purple-500/20 hover:text-purple-300 border border-[#2b324d] px-3 py-1 text-zinc-300 font-medium transition-colors"
                  >
                    🎵 Chill Playlist
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="tab-file"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
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
                <div className="flex items-center justify-between rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                      <Film className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                        {localFileName}
                      </p>
                      <p className="text-xs text-blue-300 font-medium">
                        Local video loaded • 100% private offline trimming
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-zinc-700 bg-[#1c2133] px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-[#252c45] transition-colors"
                    >
                      Change file
                    </button>
                    <button
                      type="button"
                      onClick={onClear}
                      aria-label="Remove file"
                      className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#2b334d] hover:border-blue-400/80 bg-[#0d0f19] hover:bg-blue-950/15 px-6 py-9 text-center cursor-pointer transition-all"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, y: -2 }}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm mb-3"
                  >
                    <Upload className="h-6 w-6" />
                  </motion.div>
                  <p className="text-sm sm:text-base font-bold text-white">
                    Drop your video here, or click to browse files
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                    Supports MP4, MOV, WebM, and MKV. Runs locally in your browser — your file never leaves your machine.
                  </p>
                </div>
              )}

              {/* Sample Generator for Offline Mode */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-t border-[#1e2338] pt-3">
                <span className="text-zinc-400 font-mono text-[11px]">
                  🔒 OFFLINE WASM ENGINE ACTIVE
                </span>
                <button
                  type="button"
                  disabled={generatingSample}
                  onClick={onGenerateLocalSample}
                  className="inline-flex items-center gap-1.5 font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {generatingSample ? 'Forging test video...' : 'Generate 5s Sample Test Video'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

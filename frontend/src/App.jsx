import React, { useEffect, useMemo, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const API_BASE = import.meta.env?.VITE_API_URL || "http://localhost:7860";
const MAX_SINGLE_SEC = 180;
const MAX_BATCH_ITEMS = 15;
const MAX_BATCH_SEC = 60;

const toMMSS = (sec = 0) => {
  const s = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
};

const toSec = (str) => {
  const parts = String(str).trim().split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] || 0;
};

const extractYouTubeId = (url) => {
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const isPlaylistUrl = (url) => /[?&]list=([a-zA-Z0-9_-]+)/.test(url);

const triggerDownload = (blob, filename) => {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
};

export default function App() {
  const [inputUrl, setInputUrl] = useState("");
  const [localFile, setLocalFile] = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [mode, setMode] = useState("idle");
  const [health, setHealth] = useState(null);

  const [startStr, setStartStr] = useState("00:05");
  const [endStr, setEndStr] = useState("00:35");
  const [localDuration, setLocalDuration] = useState(180);
  const videoRef = useRef(null);
  const ffmpegRef = useRef(null);

  const [playlistTitle, setPlaylistTitle] = useState("");
  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const getFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    if (file.size > 1.8 * 1024 ** 3) {
      setError("Local files over 1.8 GB may exceed browser WASM memory limits.");
    } else {
      setError("");
    }
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalFile(file);
    setLocalPreviewUrl(URL.createObjectURL(file));
    setInputUrl("");
    setMode("local");
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    const url = inputUrl.trim();
    if (!url) return;
    setError("");
    setLocalFile(null);

    if (isPlaylistUrl(url)) {
      setMode("playlist");
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/playlist-meta?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error("Failed to load playlist metadata");
        const data = await res.json();
        setPlaylistTitle(data.title || "Playlist");
        setRows(
          (data.entries || []).map((item, i) => ({
            ...item,
            selected: i < 5,
            startStr: "00:00",
            endStr: toMMSS(Math.min(item.duration || 30, 30)),
          }))
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (extractYouTubeId(url)) {
      setMode("single");
      return;
    }

    setError("Paste a valid YouTube video/playlist URL or drop a local video file.");
  };

  const startSec = toSec(startStr);
  const endSec = toSec(endStr);
  const singleDuration = Math.max(0, endSec - startSec);
  const singleValid = singleDuration > 0 && singleDuration <= MAX_SINGLE_SEC;

  const handleDownloadSingle = async () => {
    setError("");
    if (!singleValid) {
      setError(`Clip must be between 1s and ${MAX_SINGLE_SEC}s.`);
      return;
    }

    if (mode === "local" && localFile) {
      setLoading(true);
      const ext = localFile.name.split(".").pop()?.toLowerCase() || "mp4";
      const inputName = `input.${ext}`;
      const outputName = `clip_${startSec}_${endSec}.${ext}`;
      try {
        const ffmpeg = await getFFmpeg();
        await ffmpeg.writeFile(inputName, await fetchFile(localFile));
        await ffmpeg.exec([
          "-ss", String(startSec),
          "-to", String(endSec),
          "-i", inputName,
          "-c", "copy",
          outputName,
        ]);
        const data = await ffmpeg.readFile(outputName);
        const blob = new Blob([data.buffer], { type: localFile.type || "video/mp4" });
        triggerDownload(blob, outputName);
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (err) {
        setError(`Local trim failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl.trim(), start_sec: startSec, end_sec: endSec }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Clip failed");
      }
      const blob = await res.blob();
      triggerDownload(blob, `clip_${startSec}_${endSec}.mp4`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);

  const applyDefaultRangeToSelected = () => {
    setRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, startStr: "00:00", endStr: "00:30" } : r))
    );
  };

  const handleDownloadBatch = async () => {
    setError("");
    if (selectedRows.length === 0 || selectedRows.length > MAX_BATCH_ITEMS) {
      setError(`Select between 1 and ${MAX_BATCH_ITEMS} videos.`);
      return;
    }
    const items = selectedRows.map((r, idx) => ({
      url: r.url,
      start_sec: toSec(r.startStr),
      end_sec: toSec(r.endStr),
      filename: `${String(idx + 1).padStart(2, "0")}_${r.title.slice(0, 32)}`,
    }));
    const invalid = items.find((it) => it.end_sec <= it.start_sec || it.end_sec - it.start_sec > MAX_BATCH_SEC);
    if (invalid) {
      setError(`Every batch clip must be 1s–${MAX_BATCH_SEC}s.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/batch-clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Batch ZIP failed");
      const blob = await res.blob();
      triggerDownload(blob, "clips_batch.zip");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const ytId = extractYouTubeId(inputUrl);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">ClipForge</h1>
            <p className="text-sm text-zinc-400">Extract timestamped clips without downloading gigabytes.</p>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
            {health
              ? `Worker: ${health.available_slots}/${health.max_concurrent_jobs} slots free`
              : "Worker: offline"}
          </span>
        </div>

        <form
          onSubmit={handleUrlSubmit}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileSelect(e.dataTransfer.files?.[0]);
          }}
          className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Paste YouTube URL or Playlist link..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
          <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-center">
            Local File
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
          >
            Load
          </button>
        </form>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-sm">
            {error}
          </div>
        )}

        {(mode === "single" || mode === "local") && (
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
              {mode === "single" && ytId ? (
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${ytId}?start=${Math.floor(startSec)}`}
                  title="Preview"
                  allowFullScreen
                />
              ) : (
                <video
                  ref={videoRef}
                  src={localPreviewUrl}
                  controls
                  onLoadedMetadata={(e) => setLocalDuration(Math.floor(e.target.duration || 180))}
                  className="w-full h-full"
                />
              )}
            </div>

            {mode === "local" && (
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={() => videoRef.current && setStartStr(toMMSS(videoRef.current.currentTime))}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  Set Start [I]
                </button>
                <button
                  type="button"
                  onClick={() => videoRef.current && setEndStr(toMMSS(videoRef.current.currentTime))}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  Set End [O]
                </button>
                <span>Max {toMMSS(localDuration)} • Processed locally</span>
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Start (MM:SS)</label>
                  <input
                    value={startStr}
                    onChange={(e) => setStartStr(e.target.value)}
                    className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">End (MM:SS)</label>
                  <input
                    value={endStr}
                    onChange={(e) => setEndStr(e.target.value)}
                    className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <span className={`text-xs ${singleValid ? "text-zinc-400" : "text-red-400"}`}>
                  {singleDuration}s / {MAX_SINGLE_SEC}s max
                </span>
              </div>

              <button
                type="button"
                disabled={loading || !singleValid}
                onClick={handleDownloadSingle}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
              >
                {loading ? "Clipping..." : mode === "local" ? "Trim Locally" : "Clip & Download MP4"}
              </button>
            </div>
          </div>
        )}

        {mode === "playlist" && (
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">{playlistTitle}</h2>
                <p className="text-xs text-zinc-400">
                  Selected: {selectedRows.length} / {MAX_BATCH_ITEMS} clips max ({MAX_BATCH_SEC}s each)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyDefaultRangeToSelected}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs"
                >
                  Apply 00:00–00:30
                </button>
                <button
                  type="button"
                  disabled={loading || selectedRows.length === 0}
                  onClick={handleDownloadBatch}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-medium"
                >
                  {loading ? "Streaming ZIP..." : `Download ZIP (${selectedRows.length})`}
                </button>
              </div>
            </div>

            {selectedRows.length > 5 && (
              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-900/60 text-xs text-blue-200 flex items-center justify-between">
                <span>Batching {selectedRows.length} clips on a free server—chip in $0.10 for a chai if it saves you time.</span>
                <a href="#tip" className="underline font-medium ml-3 shrink-0">Tip $0.10</a>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto divide-y divide-zinc-800 border border-zinc-800 rounded-xl">
              {rows.map((row, idx) => (
                <div key={row.id} className="p-3 flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={!row.selected && selectedRows.length >= MAX_BATCH_ITEMS}
                    onChange={() =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
                      )
                    }
                  />
                  <span className="flex-1 truncate" title={row.title}>
                    {idx + 1}. {row.title}
                  </span>
                  <span className="text-xs text-zinc-500 w-12 text-right">
                    {row.duration ? toMMSS(row.duration) : "--:--"}
                  </span>
                  <input
                    value={row.startStr}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, startStr: e.target.value } : r))
                      )
                    }
                    className="w-16 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono"
                  />
                  <input
                    value={row.endStr}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, endStr: e.target.value } : r))
                      )
                    }
                    className="w-16 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

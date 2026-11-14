import React, { useRef, useState, useCallback } from 'react';
import { formatTimecode } from '../lib/clipforge';

interface FilmstripScrubberProps {
  startSec: number;
  endSec: number;
  durationSec: number;
  playheadSec?: number;
  onChange: (startSec: number, endSec: number) => void;
  maxCapSec?: number | null;
}

export function FilmstripScrubber({
  startSec,
  endSec,
  durationSec,
  playheadSec = 0,
  onChange,
  maxCapSec = 180,
}: FilmstripScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'window' | null>(null);
  const dragStartX = useRef<number>(0);
  const dragStartValues = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const total = Math.max(durationSec || 60, 10);
  const startPercent = Math.min(100, Math.max(0, (startSec / total) * 100));
  const endPercent = Math.min(100, Math.max(startPercent, (endSec / total) * 100));
  const playheadPercent = Math.min(100, Math.max(0, (playheadSec / total) * 100));

  const getTimeFromX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(fraction * total);
    },
    [total],
  );

  const handlePointerDown = (type: 'start' | 'end' | 'window', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(type);
    dragStartX.current = e.clientX;
    dragStartValues.current = { start: startSec, end: endSec };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !trackRef.current) return;
    const currentSec = getTimeFromX(e.clientX);

    if (dragging === 'start') {
      const nextStart = Math.max(0, Math.min(currentSec, endSec - 1));
      if (maxCapSec && endSec - nextStart > maxCapSec) {
        onChange(endSec - maxCapSec, endSec);
      } else {
        onChange(nextStart, endSec);
      }
    } else if (dragging === 'end') {
      const nextEnd = Math.min(total, Math.max(currentSec, startSec + 1));
      if (maxCapSec && nextEnd - startSec > maxCapSec) {
        onChange(startSec, startSec + maxCapSec);
      } else {
        onChange(startSec, nextEnd);
      }
    } else if (dragging === 'window') {
      const rect = trackRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartX.current;
      const deltaSec = Math.round((deltaX / rect.width) * total);
      const span = dragStartValues.current.end - dragStartValues.current.start;

      let nextStart = dragStartValues.current.start + deltaSec;
      nextStart = Math.max(0, Math.min(total - span, nextStart));
      onChange(nextStart, nextStart + span);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragging) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
      setDragging(null);
    }
  };

  // Generate tick markers
  const tickCount = 12;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const sec = Math.round((i / tickCount) * total);
    return { percent: (i / tickCount) * 100, label: formatTimecode(sec) };
  });

  return (
    <div className="space-y-3 select-none">
      {/* Timecode Header Banner */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>IN:</span>
          <span className="font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-700/60 shadow-xs">
            {formatTimecode(startSec)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-sans font-medium">
            Clip Duration:
          </span>
          <span className="font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2.5 py-0.5 rounded-full">
            {Math.max(1, endSec - startSec)}s
            {maxCapSec ? ` (max ${maxCapSec}s)` : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
          <span>OUT:</span>
          <span className="font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-700/60 shadow-xs">
            {formatTimecode(endSec)}
          </span>
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
        </div>
      </div>

      {/* Physical 35mm Filmstrip Track */}
      <div
        ref={trackRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative h-20 w-full rounded-2xl bg-slate-900 dark:bg-[#141724] border border-slate-300 dark:border-[#2a2f45] overflow-hidden shadow-inner cursor-pointer"
        onClick={(e) => {
          if (dragging) return;
          const clickedSec = getTimeFromX(e.clientX);
          if (Math.abs(clickedSec - startSec) < Math.abs(clickedSec - endSec)) {
            onChange(Math.min(clickedSec, endSec - 1), endSec);
          } else {
            onChange(startSec, Math.max(clickedSec, startSec + 1));
          }
        }}
      >
        {/* Top Sprocket Perforations */}
        <div className="absolute top-1 inset-x-0 flex justify-between px-2 pointer-events-none opacity-40">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-2.5 h-1.5 rounded-xs bg-zinc-950 border border-zinc-700/50" />
          ))}
        </div>

        {/* Bottom Sprocket Perforations */}
        <div className="absolute bottom-1 inset-x-0 flex justify-between px-2 pointer-events-none opacity-40">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-2.5 h-1.5 rounded-xs bg-zinc-950 border border-zinc-700/50" />
          ))}
        </div>

        {/* Film Frame Divider Lines */}
        <div className="absolute inset-y-3 inset-x-0 flex justify-between px-4 pointer-events-none opacity-15">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-[1px] h-full bg-zinc-400 border-r border-dashed border-zinc-600" />
          ))}
        </div>

        {/* Dimmed Inactive Left Region */}
        <div
          className="absolute inset-y-0 left-0 bg-black/60 pointer-events-none border-r border-emerald-500/40"
          style={{ width: `${startPercent}%` }}
        />

        {/* Active Selected Clip Window (Movable) */}
        <div
          onPointerDown={(e) => handlePointerDown('window', e)}
          className="absolute inset-y-1 rounded-xl bg-gradient-to-r from-orange-500/25 via-rose-500/30 to-amber-500/25 border-y-2 border-orange-500/80 shadow-[0_0_20px_rgba(255,107,0,0.15)] cursor-grab active:cursor-grabbing backdrop-blur-xs flex items-center justify-center group"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(1, endPercent - startPercent)}%`,
          }}
        >
          {/* Subtle Grip Ridges in Center */}
          <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
            <div className="w-1 h-6 rounded-full bg-white/60" />
            <div className="w-1 h-6 rounded-full bg-white/60" />
            <div className="w-1 h-6 rounded-full bg-white/60" />
          </div>
        </div>

        {/* Dimmed Inactive Right Region */}
        <div
          className="absolute inset-y-0 right-0 bg-black/60 pointer-events-none border-l border-rose-500/40"
          style={{ width: `${100 - endPercent}%` }}
        />

        {/* Start Handle (Green Brass Clamp) */}
        <div
          onPointerDown={(e) => handlePointerDown('start', e)}
          className="absolute inset-y-0 w-6 -translate-x-1/2 flex items-center justify-center cursor-ew-resize z-20 group"
          style={{ left: `${startPercent}%` }}
        >
          <div className="h-full w-3 rounded-l-lg bg-emerald-500 group-hover:bg-emerald-400 group-active:bg-emerald-300 shadow-md flex items-center justify-center border-l border-emerald-300 transition-colors">
            <div className="w-0.5 h-6 bg-emerald-950/60 rounded-full" />
          </div>
        </div>

        {/* End Handle (Red Brass Clamp) */}
        <div
          onPointerDown={(e) => handlePointerDown('end', e)}
          className="absolute inset-y-0 w-6 -translate-x-1/2 flex items-center justify-center cursor-ew-resize z-20 group"
          style={{ left: `${endPercent}%` }}
        >
          <div className="h-full w-3 rounded-r-lg bg-rose-500 group-hover:bg-rose-400 group-active:bg-rose-300 shadow-md flex items-center justify-center border-r border-rose-300 transition-colors">
            <div className="w-0.5 h-6 bg-rose-950/60 rounded-full" />
          </div>
        </div>

        {/* Current Video Playhead Line (if provided) */}
        {playheadSec > 0 && playheadPercent >= 0 && playheadPercent <= 100 && (
          <div
            className="absolute inset-y-0 w-[2px] bg-white shadow-[0_0_8px_white] pointer-events-none z-30"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="absolute -top-1 -left-1.5 h-3 w-3 rotate-45 bg-white rounded-xs" />
          </div>
        )}
      </div>

      {/* Millisecond / Tick Guide Markers */}
      <div className="flex justify-between px-1 text-[10px] font-mono text-slate-500 dark:text-zinc-400">
        {ticks.map((t, idx) => (
          <span key={idx} className={idx % 2 === 0 ? 'inline' : 'hidden sm:inline'}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

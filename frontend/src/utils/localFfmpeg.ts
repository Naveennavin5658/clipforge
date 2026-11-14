import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

const CORE_VERSION = '0.12.6';
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

export async function getFFmpeg(onProgress?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    onProgress?.('Loading single-threaded ffmpeg.wasm core (~31 MB)...');

    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    ]);

    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

export async function trimLocalVideoWithWasm(options: {
  file: File;
  startSec: number;
  endSec: number;
  onStatus?: (status: string) => void;
}): Promise<{ blob: Blob; filename: string }> {
  const { file, startSec, endSec, onStatus } = options;
  const ffmpeg = await getFFmpeg(onStatus);

  const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
  const safeExt = ['mp4', 'webm', 'mov', 'mkv'].includes(ext) ? ext : 'mp4';

  const inputName = `input.${safeExt}`;
  const outputName = `clip_${Math.floor(startSec)}-${Math.floor(endSec)}.${safeExt}`;

  onStatus?.('Mounting local file into browser memory...');
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const duration = Math.max(1, endSec - startSec);
  onStatus?.(`Stream-copying ${duration}s segment (-c copy)...`);

  try {
    await ffmpeg.exec([
      '-ss',
      String(startSec),
      '-i',
      inputName,
      '-t',
      String(duration),
      '-c',
      'copy',
      '-avoid_negative_ts',
      'make_zero',
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(String(data));
    const mimeType = safeExt === 'webm' ? 'video/webm' : 'video/mp4';
    const blob = new Blob([bytes.buffer], { type: mimeType });
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return {
      blob,
      filename: `${baseName}_${Math.floor(startSec)}-${Math.floor(endSec)}.${safeExt}`,
    };
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

/**
 * Generates a real 5-second WebM video File in the browser using HTML5 Canvas + MediaRecorder
 * so users can verify local zero-upload trimming without hunting for a file on disk.
 */
export async function generateSyntheticLocalVideo(): Promise<File> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('Browser MediaRecorder is unavailable in this environment.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const stream = canvas.captureStream(24);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
    ? 'video/webm;codecs=vp8'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };

  const stopped = new Promise<File>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(new File([blob], 'clipforge_sample_5s.webm', { type: 'video/webm' }));
    };
  });

  recorder.start(100);
  const start = performance.now();
  const durationMs = 4500;

  const drawFrame = () => {
    const elapsed = performance.now() - start;
    const progress = Math.min(1, elapsed / durationMs);

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e11d48';
    ctx.fillRect(48, 250, (canvas.width - 96) * progress, 10);

    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 250, canvas.width - 96, 10);

    ctx.fillStyle = '#fafafa';
    ctx.font = '600 28px sans-serif';
    ctx.fillText('ClipForge Local Sample', 48, 120);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '20px monospace';
    ctx.fillText(`Timecode: ${(elapsed / 1000).toFixed(2)}s / 04.50s`, 48, 175);

    if (elapsed < durationMs) {
      requestAnimationFrame(drawFrame);
    } else {
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
    }
  };

  requestAnimationFrame(drawFrame);
  return stopped;
}

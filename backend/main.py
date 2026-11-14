import asyncio
import json
import os
import re
import shutil
import sys
import tempfile
import uuid
from contextlib import contextmanager
from typing import Iterator, List, Optional

# Ensure virtualenv bin and common tool locations (Homebrew ffmpeg) are on PATH
_extra_paths = [
    os.path.dirname(sys.executable),
    "/opt/homebrew/bin",
    "/usr/local/bin",
]
for _p in _extra_paths:
    if os.path.isdir(_p) and _p not in os.environ.get("PATH", "").split(os.pathsep):
        os.environ["PATH"] = _p + os.pathsep + os.environ.get("PATH", "")

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from zipstream import ZipStream

MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "3"))
MAX_SINGLE_DURATION_SEC = 180
MAX_BATCH_DURATION_SEC = 60
MAX_BATCH_ITEMS = 15
MAX_PLAYLIST_ITEMS = 50
SUBPROCESS_TIMEOUT_SEC = 120
MAX_HEIGHT = 1080

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
]

app = FastAPI(title="ClipForge Backend", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Clip-Cache-Key", "Retry-After"],
)

semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)
active_jobs = 0


def _parse_timecode(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip()
    if not val_str:
        return None
    try:
        return float(val_str)
    except ValueError:
        pass
    parts = val_str.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    except Exception:
        return None
    return None


class ClipRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=512)
    start_sec: Optional[float] = Field(default=None, ge=0)
    end_sec: Optional[float] = Field(default=None, gt=0)
    start_time: Optional[str] = Field(default=None)
    end_time: Optional[str] = Field(default=None)
    cookies_txt: Optional[str] = Field(default=None, max_length=200_000)
    po_token: Optional[str] = Field(default=None, max_length=2048)


class BatchClipItem(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    title: Optional[str] = Field(default="clip", max_length=180)
    url: str = Field(..., min_length=8, max_length=512)
    start_sec: float = Field(..., ge=0)
    end_sec: float = Field(..., gt=0)


class BatchClipRequest(BaseModel):
    items: List[BatchClipItem] = Field(..., min_length=1, max_length=MAX_BATCH_ITEMS)
    cookies_txt: Optional[str] = Field(default=None, max_length=200_000)
    po_token: Optional[str] = Field(default=None, max_length=2048)


def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", name).strip("_")
    return (cleaned or "clip")[:80]


def _extract_youtube_id(url: str) -> Optional[str]:
    match = re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([a-zA-Z0-9_-]{11})", url)
    return match.group(1) if match else None


def _classify_yt_dlp_error(stderr: str) -> tuple[int, dict]:
    lower = stderr.lower()
    if any(
        needle in lower
        for needle in (
            "http error 403",
            "sign in to confirm you're not a bot",
            "sign in to confirm you\u2019re not a bot",
            "not a bot",
            "po token",
            "cookies are required",
            "use --cookies",
        )
    ):
        return 403, {
            "code": "YT_BOT_CHECK",
            "message": "YouTube flagged this datacenter request for bot verification (HTTP 403).",
            "hint": "Expand Bot-Check Bypass in the UI and attach Netscape cookies.txt or a PO Token from your browser session.",
            "needs_bot_bypass": True,
        }

    if "private video" in lower or "video unavailable" in lower or "members-only" in lower:
        return 404, {
            "code": "YT_UNAVAILABLE",
            "message": "This video is private, age-restricted, or unavailable.",
            "hint": "Confirm the video is public or supply session cookies if you have access.",
            "needs_bot_bypass": False,
        }

    if "live event" in lower or "is live" in lower:
        return 400, {
            "code": "LIVE_STREAM_UNSUPPORTED",
            "message": "Active live streams cannot be section-clipped until they finish processing.",
            "hint": "Wait until the VOD archive is available, or trim a local recording.",
            "needs_bot_bypass": False,
        }

    return 500, {
        "code": "EXTRACTION_FAILED",
        "message": stderr.strip().splitlines()[-1][:300] if stderr.strip() else "yt-dlp failed to extract the requested section.",
        "hint": "Verify the URL and try a shorter timestamp window.",
        "needs_bot_bypass": False,
    }


@contextmanager
def _ephemeral_cookie_file(cookies_txt: Optional[str]) -> Iterator[Optional[str]]:
    if not cookies_txt or not cookies_txt.strip():
        yield None
        return

    fd, path = tempfile.mkstemp(prefix="cf_ck_", suffix=".txt")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(cookies_txt.strip() + "\n")
        os.chmod(path, 0o600)
        yield path
    finally:
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


def _get_yt_dlp_cmd() -> List[str]:
    # Check if yt-dlp binary is directly available in PATH
    binary = shutil.which("yt-dlp")
    if binary:
        return [binary]
    # Check adjacent to sys.executable (e.g. inside .venv/bin)
    venv_bin = os.path.join(os.path.dirname(sys.executable), "yt-dlp")
    if os.path.exists(venv_bin) and os.access(venv_bin, os.X_OK):
        return [venv_bin]
    # Fallback to python -m yt_dlp
    return [sys.executable, "-m", "yt_dlp"]


async def _run_cmd(args: List[str], timeout: int = SUBPROCESS_TIMEOUT_SEC) -> tuple[int, bytes, bytes]:
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except Exception as exc:
        print(f"[SUBPROCESS SPAWN ERROR] cmd={' '.join(args[:4])}... error={exc}", file=sys.stderr)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "SPAWN_ERROR",
                "message": f"Failed to execute {args[0]}: {str(exc)}",
            },
        )

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        if proc.returncode != 0:
            err_text = stderr.decode("utf-8", errors="replace").strip()
            print(f"[SUBPROCESS FAILED] rc={proc.returncode} cmd={' '.join(args[:6])}...\nstderr: {err_text}", file=sys.stderr)
        return proc.returncode or 0, stdout, stderr
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        await proc.wait()
        raise HTTPException(
            status_code=504,
            detail={
                "code": "TIMEOUT",
                "message": f"Extraction exceeded {timeout}s subprocess timeout.",
                "hint": "Try a shorter clip duration or retry when YouTube throttling subsides.",
            },
        )


def _build_yt_dlp_base_args(cookie_path: Optional[str], po_token: Optional[str]) -> List[str]:
    args = list(_get_yt_dlp_cmd())
    args.extend([
        "--no-warnings",
        "--no-playlist",
        "--socket-timeout",
        "20",
        "--retries",
        "2",
    ])
    if cookie_path:
        args.extend(["--cookies", cookie_path])
    if po_token and po_token.strip():
        clean_token = po_token.strip().replace('"', "")
        args.extend(["--extractor-args", f"youtube:po_token=web+{clean_token}"])
    return args


def _cleanup_dir(path: str) -> None:
    shutil.rmtree(path, ignore_errors=True)


STATS_FILE = os.getenv("STATS_FILE", os.path.join(os.path.dirname(__file__), "stats.json"))
DEFAULT_BASE_CLIPS = 0


def _load_stats() -> dict:
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "total_clips": 0,
        "seconds_saved": 0,
    }


def _increment_stats(count: int = 1, duration_sec: float = 30.0) -> dict:
    stats = _load_stats()
    stats["total_clips"] = stats.get("total_clips", DEFAULT_BASE_CLIPS) + count
    stats["seconds_saved"] = stats.get("seconds_saved", DEFAULT_BASE_CLIPS * 42) + int(duration_sec)
    try:
        with open(STATS_FILE, "w", encoding="utf-8") as f:
            json.dump(stats, f)
    except Exception:
        pass
    return stats


class IncrementStatsRequest(BaseModel):
    count: int = Field(default=1, ge=1, le=50)
    duration_sec: float = Field(default=15.0, ge=1, le=3600)


@app.get("/health")
async def health():
    available = max(0, MAX_CONCURRENT_JOBS - active_jobs)
    return {
        "status": "ok",
        "active_slots": active_jobs,
        "available_slots": available,
        "max_slots": MAX_CONCURRENT_JOBS,
    }


@app.get("/stats")
async def get_stats():
    return _load_stats()


@app.post("/stats/increment")
async def increment_stats(req: IncrementStatsRequest):
    return _increment_stats(req.count, req.duration_sec)


@app.get("/playlist-meta")
async def playlist_meta(
    url: str = Query(..., min_length=8, max_length=512),
    x_yt_cookies: Optional[str] = Header(default=None),
    x_yt_po_token: Optional[str] = Header(default=None),
):
    global active_jobs
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=8.0)
    except asyncio.TimeoutError:
        return JSONResponse(
            status_code=503,
            content={
                "code": "SLOTS_BUSY",
                "message": "All worker slots are busy right now.",
                "hint": "Wait 10–20 seconds and retry.",
            },
        )

    active_jobs += 1
    try:
        with _ephemeral_cookie_file(x_yt_cookies) as cookie_path:
            args = list(_get_yt_dlp_cmd())
            args.extend([
                "--flat-playlist",
                "--dump-single-json",
                "--playlist-end",
                str(MAX_PLAYLIST_ITEMS),
                "--no-warnings",
            ])
            if cookie_path:
                args.extend(["--cookies", cookie_path])
            if x_yt_po_token and x_yt_po_token.strip():
                clean_token = x_yt_po_token.strip().replace('"', "")
                args.extend(["--extractor-args", f"youtube:po_token=web+{clean_token}"])
            args.append(url)

            rc, stdout, stderr = await _run_cmd(args, timeout=45)
            if rc != 0:
                status_code, payload = _classify_yt_dlp_error(stderr.decode("utf-8", errors="replace"))
                return JSONResponse(status_code=status_code, content=payload)

            data = json.loads(stdout.decode("utf-8", errors="replace"))
            entries = data.get("entries") or []
            items = []
            for idx, entry in enumerate(entries[:MAX_PLAYLIST_ITEMS]):
                vid_id = entry.get("id") or f"item_{idx}"
                vid_url = entry.get("url") or f"https://www.youtube.com/watch?v={vid_id}"
                if not vid_url.startswith("http"):
                    vid_url = f"https://www.youtube.com/watch?v={vid_id}"
                items.append(
                    {
                        "id": vid_id,
                        "title": entry.get("title") or f"Track {idx + 1}",
                        "duration": entry.get("duration"),
                        "url": vid_url,
                    }
                )

            return {
                "list_id": data.get("id"),
                "title": data.get("title") or "YouTube Playlist",
                "item_count": len(items),
                "capped_at": MAX_PLAYLIST_ITEMS,
                "items": items,
            }
    finally:
        active_jobs = max(0, active_jobs - 1)
        semaphore.release()


async def _extract_single_to_file(
    url: str,
    start_sec: float,
    end_sec: float,
    out_path: str,
    cookies_txt: Optional[str],
    po_token: Optional[str],
) -> None:
    with _ephemeral_cookie_file(cookies_txt) as cookie_path:
        args = _build_yt_dlp_base_args(cookie_path, po_token)
        section = f"*{int(start_sec)}-{int(end_sec)}"
        fmt = (
            f"bestvideo[height<={MAX_HEIGHT}][ext=mp4]+bestaudio[ext=m4a]/"
            f"bestvideo[height<={MAX_HEIGHT}]+bestaudio[ext=m4a]/"
            f"bestvideo[height<={MAX_HEIGHT}]+bestaudio/"
            f"best[height<={MAX_HEIGHT}]/best"
        )
        args.extend(
            [
                "-f",
                fmt,
                "--download-sections",
                section,
                "--force-keyframes-at-cuts",
                "--merge-output-format",
                "mp4",
                "--postprocessor-args",
                "ffmpeg:-c:v copy -c:a aac -movflags +faststart",
                "-o",
                out_path,
                url,
            ]
        )
        rc, _stdout, stderr = await _run_cmd(args, timeout=SUBPROCESS_TIMEOUT_SEC)
        if rc != 0 or not os.path.exists(out_path):
            status_code, payload = _classify_yt_dlp_error(stderr.decode("utf-8", errors="replace"))
            raise HTTPException(status_code=status_code, detail=payload)


@app.post("/clip")
async def clip_single(req: ClipRequest, background_tasks: BackgroundTasks):
    global active_jobs
    start = req.start_sec if req.start_sec is not None else _parse_timecode(req.start_time)
    if start is None:
        start = 0.0

    end = req.end_sec if req.end_sec is not None else _parse_timecode(req.end_time)
    if end is None:
        end = start + 30.0

    duration = end - start
    if duration <= 0 or duration > MAX_SINGLE_DURATION_SEC:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_RANGE",
                "message": f"Clip duration must be between 1s and {MAX_SINGLE_DURATION_SEC}s.",
            },
        )

    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=10.0)
    except asyncio.TimeoutError:
        return JSONResponse(
            status_code=503,
            content={
                "code": "SLOTS_BUSY",
                "message": "All 3 concurrency slots are busy. Retry in a few seconds.",
            },
        )

    active_jobs += 1
    work_dir = tempfile.mkdtemp(prefix="cf_single_")
    vid_id = _extract_youtube_id(req.url) or "video"
    out_file = os.path.join(work_dir, f"{vid_id}_{int(start)}_{int(end)}.mp4")

    try:
        await _extract_single_to_file(
            req.url,
            start,
            end,
            out_file,
            req.cookies_txt,
            req.po_token,
        )
        _increment_stats(1, duration)
        background_tasks.add_task(_cleanup_dir, work_dir)
        cache_key = f"{vid_id}:{int(start)}:{int(end)}"
        return FileResponse(
            out_file,
            media_type="video/mp4",
            filename=os.path.basename(out_file),
            headers={"X-Clip-Cache-Key": cache_key},
        )
    except HTTPException as exc:
        _cleanup_dir(work_dir)
        content = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        return JSONResponse(status_code=exc.status_code, content=content)
    except Exception as exc:
        _cleanup_dir(work_dir)
        return JSONResponse(
            status_code=500,
            content={"code": "INTERNAL_ERROR", "message": str(exc)[:300]},
        )
    finally:
        active_jobs = max(0, active_jobs - 1)
        semaphore.release()


@app.post("/batch-clip")
async def batch_clip(req: BatchClipRequest):
    if len(req.items) > MAX_BATCH_ITEMS:
        raise HTTPException(
            status_code=400,
            detail={"code": "BATCH_TOO_LARGE", "message": f"Max {MAX_BATCH_ITEMS} clips per batch."},
        )

    for item in req.items:
        dur = item.end_sec - item.start_sec
        if dur <= 0 or dur > MAX_BATCH_DURATION_SEC:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_RANGE",
                    "message": f"Item '{item.title or item.id}' exceeds {MAX_BATCH_DURATION_SEC}s batch clip limit.",
                },
            )

    async def zip_generator():
        global active_jobs
        zs = ZipStream(sized=False)
        failures: List[str] = []

        for idx, item in enumerate(req.items, start=1):
            work_dir = tempfile.mkdtemp(prefix=f"cf_batch_{uuid.uuid4().hex[:6]}_")
            safe_title = _sanitize_filename(item.title or item.id)
            filename = f"{idx:02d}_{safe_title}_{int(item.start_sec)}-{int(item.end_sec)}.mp4"
            out_path = os.path.join(work_dir, filename)

            await semaphore.acquire()
            active_jobs += 1
            try:
                await _extract_single_to_file(
                    item.url,
                    item.start_sec,
                    item.end_sec,
                    out_path,
                    req.cookies_txt,
                    req.po_token,
                )
                _increment_stats(1, item.end_sec - item.start_sec)

                def _read_and_delete(file_path: str, dir_path: str):
                    try:
                        with open(file_path, "rb") as f:
                            while chunk := f.read(1024 * 256):
                                yield chunk
                    finally:
                        _cleanup_dir(dir_path)

                zs.add(_read_and_delete(out_path, work_dir), filename)
                for chunk in zs:
                    yield chunk
            except HTTPException as exc:
                _cleanup_dir(work_dir)
                detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
                failures.append(f"{filename}: {detail.get('message', 'Failed')}")
            except Exception as exc:
                _cleanup_dir(work_dir)
                failures.append(f"{filename}: {str(exc)[:180]}")
            finally:
                active_jobs = max(0, active_jobs - 1)
                semaphore.release()

        if failures:
            report_text = "Some clips could not be extracted:\n\n" + "\n".join(failures) + "\n"
            zs.add(report_text.encode("utf-8"), "_clipforge_errors.txt")

        for chunk in zs:
            yield chunk

    return StreamingResponse(
        zip_generator(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="clipforge_batch.zip"'},
    )

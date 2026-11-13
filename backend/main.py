import asyncio
import json
import os
import re
import shutil
import uuid
import zipfile
from pathlib import Path
from typing import List, Optional

import zipstream
from anyio import from_thread
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field, HttpUrl, model_validator

MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "3"))
MAX_CLIP_SECONDS = int(os.getenv("MAX_CLIP_SECONDS", "180"))
MAX_BATCH_ITEMS = int(os.getenv("MAX_BATCH_ITEMS", "15"))
MAX_BATCH_CLIP_SECONDS = int(os.getenv("MAX_BATCH_CLIP_SECONDS", "60"))
JOB_TIMEOUT_SECONDS = int(os.getenv("JOB_TIMEOUT_SECONDS", "120"))

app = FastAPI(title="ClipForge Worker")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

job_semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)


class ClipRequest(BaseModel):
    url: HttpUrl
    start_sec: float = Field(ge=0)
    end_sec: float = Field(gt=0)
    max_height: int = Field(default=1080, ge=360, le=1080)

    @model_validator(mode="after")
    def validate_range(self):
        duration = self.end_sec - self.start_sec
        if duration <= 0:
            raise ValueError("end_sec must be greater than start_sec")
        if duration > MAX_CLIP_SECONDS:
            raise ValueError(f"Clip duration exceeds {MAX_CLIP_SECONDS}s cap")
        return self


class BatchClipItem(ClipRequest):
    filename: Optional[str] = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def validate_batch_duration(self):
        if (self.end_sec - self.start_sec) > MAX_BATCH_CLIP_SECONDS:
            raise ValueError(f"Batch clip duration exceeds {MAX_BATCH_CLIP_SECONDS}s cap")
        return self


class BatchClipRequest(BaseModel):
    items: List[BatchClipItem] = Field(min_length=1, max_length=MAX_BATCH_ITEMS)


def cleanup_dir(path: Path) -> None:
    shutil.rmtree(path, ignore_errors=True)


def safe_filename(name: Optional[str], fallback: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", name or "").strip("._")
    if not cleaned:
        return f"{fallback}.mp4"
    return cleaned if cleaned.lower().endswith(".mp4") else f"{cleaned}.mp4"


async def download_clip(req: ClipRequest, work_dir: Path) -> Path:
    work_dir.mkdir(parents=True, exist_ok=True)
    output_template = str(work_dir / "clip.%(ext)s")

    fmt = (
        f"bestvideo[height<={req.max_height}][ext=mp4]+bestaudio[ext=m4a]/"
        f"bestvideo[height<={req.max_height}]+bestaudio[ext=m4a]/"
        f"bestvideo[height<={req.max_height}]+bestaudio/"
        f"best[height<={req.max_height}]/best"
    )
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--no-warnings",
        "--format", fmt,
        "--download-sections", f"*{req.start_sec}-{req.end_sec}",
        "--merge-output-format", "mp4",
        "--postprocessor-args", "ffmpeg:-c:v copy -c:a aac",
        "--output", output_template,
        str(req.url),
    ]

    async with job_semaphore:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=JOB_TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise HTTPException(status_code=504, detail="Clip job timed out")

        if proc.returncode != 0:
            full_err = stderr.decode(errors="ignore").strip()
            import sys
            print(f"[yt-dlp FAILED] returncode={proc.returncode}\n"
                  f"  cmd={' '.join(cmd)}\n"
                  f"  stderr={full_err}", file=sys.stderr)
            err_msg = full_err.splitlines()[-1:] or ["yt-dlp failed"]
            raise HTTPException(status_code=502, detail=err_msg[0])

        files = list(work_dir.glob("clip.*"))
        if not files:
            raise HTTPException(status_code=500, detail="Output file not generated")
        return files[0]


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "max_concurrent_jobs": MAX_CONCURRENT_JOBS,
        "available_slots": job_semaphore._value,
    }


@app.get("/playlist-meta")
async def playlist_meta(url: str, limit: int = 50):
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--dump-single-json",
        "--playlist-end", str(min(limit, 50)),
        url,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=20)
    if proc.returncode != 0:
        raise HTTPException(status_code=400, detail="Could not read playlist metadata")

    data = json.loads(stdout.decode())
    entries = [
        {
            "id": e.get("id"),
            "title": e.get("title"),
            "duration": e.get("duration"),
            "url": f"https://www.youtube.com/watch?v={e.get('id')}",
        }
        for e in (data.get("entries") or [])
        if e.get("id")
    ]
    return {"title": data.get("title"), "count": len(entries), "entries": entries}


@app.post("/clip")
async def create_clip(req: ClipRequest, background_tasks: BackgroundTasks):
    work_dir = Path("/tmp") / f"clip_{uuid.uuid4().hex}"
    try:
        clip_path = await download_clip(req, work_dir)
        background_tasks.add_task(cleanup_dir, work_dir)
        return FileResponse(
            path=clip_path,
            media_type="video/mp4",
            filename=f"clip_{int(req.start_sec)}_{int(req.end_sec)}.mp4",
        )
    except Exception:
        cleanup_dir(work_dir)
        raise


@app.post("/batch-clip")
def create_batch_clip(req: BatchClipRequest):
    batch_id = uuid.uuid4().hex
    zs = zipstream.ZipStream(compress_type=zipfile.ZIP_STORED)

    for idx, item in enumerate(req.items, start=1):
        arcname = safe_filename(item.filename, f"clip_{idx:02d}_{int(item.start_sec)}_{int(item.end_sec)}")
        item_dir = Path("/tmp") / f"batch_{batch_id}_{idx}"

        def stream_one(clip_req: BatchClipItem = item, work_dir: Path = item_dir):
            try:
                clip_path = from_thread.run(download_clip, clip_req, work_dir)
                with open(clip_path, "rb") as f:
                    while chunk := f.read(64 * 1024):
                        yield chunk
            except Exception as exc:
                detail = getattr(exc, "detail", str(exc))
                yield f"Failed to clip {clip_req.url}: {detail}\n".encode()
            finally:
                cleanup_dir(work_dir)

        zs.add(stream_one(), arcname=arcname)

    return StreamingResponse(
        zs,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="clips_{batch_id[:8]}.zip"'},
    )

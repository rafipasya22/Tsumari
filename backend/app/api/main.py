import re
import shutil
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from app.api.schemas import JobCreated, JobStatus
from app.core import jobs
from app.core.settings import settings

app = FastAPI(title="Tsumari API")

READ_CHUNK = 1024 * 1024 
LANG_RE = re.compile(r"^[a-z]{2,3}$")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/jobs", response_model=JobCreated, status_code=202)
def create_job(file: UploadFile = File(...), language: str | None = Form(None)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in settings.allowed_exts:
        raise HTTPException(415, f"Unsupported file type '{ext}'.")
    if language is not None and not LANG_RE.match(language):
        raise HTTPException(422, "language must be a short code like 'en' or 'id'.")

    job_id = str(uuid.uuid4())
    job_dir = settings.jobs_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    dest = job_dir / f"input{ext}"  
    max_bytes = settings.max_upload_mb * 1024 * 1024

    try:
        size = 0
        with dest.open("wb") as out:
            while chunk := file.file.read(READ_CHUNK):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(413, f"File exceeds {settings.max_upload_mb} MB.")
                out.write(chunk)
        if size == 0:
            raise HTTPException(400, "Empty file.")
        row = jobs.create_job(job_id, file.filename, str(dest), language)
    except Exception:
        shutil.rmtree(job_dir, ignore_errors=True) 
        raise

    return {"id": row["id"], "status": row["status"]}


@app.get("/jobs/{job_id}", response_model=JobStatus)
def job_status(job_id: UUID):
    row = jobs.get_job(str(job_id))
    if row is None:
        raise HTTPException(404, "Job not found.")
    return row


@app.get("/jobs/{job_id}/transcript")
def job_transcript(job_id: UUID):
    row = jobs.get_transcript(str(job_id))
    if row is None:
        raise HTTPException(404, "Job not found.")
    if row["status"] != "done":
        raise HTTPException(409, "Job is not finished yet.")
    return row["transcript"] or []
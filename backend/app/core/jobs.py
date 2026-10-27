from app.core.db import get_client
from datetime import datetime, timezone
import time

import httpx


def _execute(query, tries: int = 3):
    for i in range(tries):
        try:
            return query.execute()
        except httpx.TransportError:
            if i == tries - 1:
                raise
            time.sleep(0.3)

PUBLIC_COLUMNS = "id,status,stage,progress,filename,error,result,youtube_id,created_at,updated_at"


def create_job(job_id: str, filename: str | None, input_path: str, language: str | None,
               youtube_id: str | None = None, user_id: str | None = None) -> dict:
    row = {"id": job_id, "filename": filename, "input_path": input_path, "language": language}
    if youtube_id:
        row["youtube_id"] = youtube_id
    if user_id:
        row["user_id"] = user_id
    res = get_client().table("jobs").insert(row).execute()
    return res.data[0]


def get_job(job_id: str, user_id: str) -> dict | None:
    res = _execute(
        get_client().table("jobs").select(PUBLIC_COLUMNS)
        .eq("id", job_id).eq("user_id", user_id).limit(1)
    )
    return res.data[0] if res.data else None


def get_transcript(job_id: str, user_id: str) -> dict | None:
    res = _execute(
        get_client().table("jobs").select("status,transcript")
        .eq("id", job_id).eq("user_id", user_id).limit(1)
    )
    return res.data[0] if res.data else None


def list_jobs(user_id: str, statuses: list[str] | None = None, limit: int = 20) -> list[dict]:
    q = get_client().table("jobs").select(PUBLIC_COLUMNS).eq("user_id", user_id)
    if statuses:
        q = q.in_("status", statuses)
    res = _execute(q.order("created_at", desc=True).limit(limit))
    return res.data or []

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def update_job(job_id: str, **fields) -> None:
    fields["updated_at"] = _now()
    get_client().table("jobs").update(fields).eq("id", job_id).execute()

def claim_next_job() -> dict | None:
    c = get_client()
    res = (c.table("jobs").select("id,input_path,language,youtube_id")
           .eq("status", "queued").order("created_at").limit(1).execute())
    if not res.data:
        return None
    job = res.data[0]
    claimed = (c.table("jobs")
               .update({"status": "running", "stage": "starting", "progress": 0, "updated_at": _now()})
               .eq("id", job["id"]).eq("status", "queued")  
               .execute())
    return job if claimed.data else None

def get_input_path(job_id: str) -> str | None:
    res = get_client().table("jobs").select("input_path").eq("id", job_id).limit(1).execute()
    return res.data[0]["input_path"] if res.data else None

def finish_job(job_id: str, result: dict, transcript: list[dict]) -> None:
    update_job(job_id, status="done", stage="done", progress=1, result=result, transcript=transcript)


def fail_job(job_id: str, error: str) -> None:
    update_job(job_id, status="failed", error=error)


def fail_stale_running() -> int:
    res = (get_client().table("jobs")
           .update({"status": "failed", "error": "Worker restarted while this job was running.",
                    "updated_at": _now()})
           .eq("status", "running").execute())
    return len(res.data or [])
import shutil
import time
import traceback

from app.core import jobs
from app.core.settings import settings
from app.pipeline.chapters import get_embedder
from app.pipeline.run import run_pipeline
from app.pipeline.transcribe import warm_up
from app.pipeline.youtube import download_audio

POLL_SECONDS = 3


def process(job: dict) -> None:
    job_id = job["id"]
    work_dir = settings.jobs_dir / job_id

    def report(stage: str, progress: float) -> None:
        jobs.update_job(job_id, stage=stage, progress=round(progress, 3))

    try:
        input_path = job["input_path"]
        if job.get("youtube_id"):
            report("downloading", 0)
            path, title = download_audio(job["youtube_id"], work_dir)
            input_path = str(path)
            jobs.update_job(job_id, input_path=input_path, filename=title)
        segments, result = run_pipeline(input_path, work_dir, job["language"], report)
        jobs.finish_job(job_id, result, segments)
        print(f"[{job_id}] done")
    except Exception as e:
        traceback.print_exc()
        jobs.fail_job(job_id, str(e)[:500])
        print(f"[{job_id}] failed")
    finally:
        shutil.rmtree(work_dir / "chunks", ignore_errors=True)
        (work_dir / "audio.wav").unlink(missing_ok=True)
        if job.get("youtube_id"):
            for f in work_dir.glob("input.*"):
                f.unlink(missing_ok=True)


def main() -> None:
    stale = jobs.fail_stale_running()  
    if stale:
        print(f"Marked {stale} stale job(s) as failed.")

    print("Loading models...")
    warm_up()
    get_embedder()
    print("Worker ready. Polling for jobs.")

    while True:
        try:
            job = jobs.claim_next_job()
        except Exception:  
            traceback.print_exc()
            time.sleep(10)
            continue
        if job is None:
            time.sleep(POLL_SECONDS)
            continue
        print(f"[{job['id']}] started")
        process(job)


if __name__ == "__main__":
    main()
import shutil
from pathlib import Path

from app.pipeline.audio import chunk_audio, normalize, probe
from app.pipeline.chapters import build_chapters
from app.pipeline.transcribe import transcribe_chunks


def run_pipeline(input_path, work_dir, language, report) -> tuple[list[dict], dict]:
    work = Path(work_dir)

    report("normalizing", 0.02)
    wav = normalize(input_path, work / "audio.wav")
    duration = probe(wav)["duration"]

    report("chunking", 0.06)
    chunks = chunk_audio(wav, work / "chunks")

    report(f"transcribing 0/{len(chunks)}", 0.10)
    segments = transcribe_chunks(
        chunks,
        language=language,
        on_progress=lambda done, total: report(f"transcribing {done}/{total}", 0.10 + 0.75 * done / total),
    )

    report("chaptering", 0.85)
    result = build_chapters(segments)
    result["duration"] = duration

    shutil.rmtree(work / "chunks", ignore_errors=True)
    return segments, result
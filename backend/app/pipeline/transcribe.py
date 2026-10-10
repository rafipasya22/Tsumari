import json
import os
import time
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
import numpy as np
from faster_whisper import WhisperModel

CPU_THREADS = int(os.environ.get("CPU_THREADS", "4")) 


@lru_cache(maxsize=1)
def get_model(model_size: str = "small") -> WhisperModel:
    return WhisperModel(model_size, device="cpu", compute_type="int8", cpu_threads=CPU_THREADS)


def warm_up(model_size: str = "small") -> None:
    """Run one tiny transcription so the first real chunk isn't slowed by initialization."""
    model = get_model(model_size)
    segments, _ = model.transcribe(np.zeros(16000, dtype=np.float32), beam_size=1)
    list(segments) 


def transcribe_chunks(
    chunks: list[dict],
    language: str | None = None,
    model_size: str = "small",
    on_progress=None,
) -> list[dict]:
    model = get_model(model_size)
    results = []
    total_audio = total_elapsed = 0.0

    for i, chunk in enumerate(chunks):
        t0 = time.perf_counter()
        segments, info = model.transcribe(
            str(chunk["path"]),
            language = language,
            vad_filter=True,
            beam_size=1,
            condition_on_previous_text=False,
        )
        if language is None:
            language = info.language
        for seg in segments:  
            results.append({
                "start": min(chunk["start"] + seg.start, chunk["end"]),
                "end": min(chunk["start"] + seg.end, chunk["end"]),
                "text": seg.text.strip(),
                "chunk": chunk["index"],
            })
        elapsed = time.perf_counter() - t0

        audio_len = chunk["end"] - chunk["start"]
        total_audio += audio_len
        total_elapsed += elapsed
        print(f"chunk {chunk['index']:03d}  audio={audio_len:6.1f}s  took={elapsed:6.1f}s  "
              f"rtf={elapsed / audio_len:.2f}  lang={info.language}")

        if on_progress:
            on_progress(i + 1, len(chunks))

    if total_audio:
        print(f"TOTAL  audio={total_audio:.1f}s  took={total_elapsed:.1f}s  "
              f"rtf={total_elapsed / total_audio:.2f}")
    return results


def save_transcript(segments: list[dict], path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)
    return path


def load_transcript(path) -> list[dict]:
    with Path(path).open(encoding="utf-8") as f:
        return json.load(f)
import json
import os
import time
from functools import lru_cache
from pathlib import Path

import groq
from dotenv import load_dotenv
from groq import Groq

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

STT_MODEL = os.getenv("WHISP")
MAX_RETRIES = 5

_LANG_CODES = {
    "english": "en", "indonesian": "id", "malay": "ms", "japanese": "ja",
    "chinese": "zh", "korean": "ko", "spanish": "es", "french": "fr",
    "german": "de", "arabic": "ar",
}


@lru_cache(maxsize=1)
def get_client() -> Groq:
    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError("Set GROQ_API_KEY in .env.")
    return Groq(max_retries=0, timeout=120)  


def warm_up() -> None:
    get_client()
    print(f"Using Groq Whisper model: {STT_MODEL}")


def _field(obj, key, default=None):
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _retry_delay(e: Exception, attempt: int) -> float:
    resp = getattr(e, "response", None)
    header = resp.headers.get("retry-after") if resp is not None else None
    try:
        return min(float(header), 120.0)
    except (TypeError, ValueError):
        return min(5.0 * 2 ** attempt, 60.0)


def _transcribe_one(path, language: str | None):
    data = Path(path).read_bytes()
    kwargs = {
        "file": (Path(path).name, data),
        "model": STT_MODEL,
        "response_format": "verbose_json",
        "timestamp_granularities": ["segment"],
        "temperature": 0.0,
    }
    if language:
        kwargs["language"] = language

    for attempt in range(MAX_RETRIES):
        try:
            return get_client().audio.transcriptions.create(**kwargs)
        except (groq.RateLimitError, groq.APIConnectionError,
                groq.APITimeoutError, groq.InternalServerError) as e:
            if attempt == MAX_RETRIES - 1:
                raise RuntimeError(f"Groq transcription failed after {MAX_RETRIES} tries: {e}") from e
            delay = _retry_delay(e, attempt)
            print(f"  Groq error ({type(e).__name__}), retrying in {delay:.0f}s")
            time.sleep(delay)


def transcribe_chunks(
    chunks: list[dict],
    language: str | None = None,
    on_progress=None,
) -> list[dict]:
    results = []
    total_audio = total_elapsed = 0.0

    for i, chunk in enumerate(chunks):
        t0 = time.perf_counter()
        resp = _transcribe_one(chunk["path"], language)

        if language is None:
            detected = str(_field(resp, "language", "") or "").lower()
            language = _LANG_CODES.get(detected)  

        for seg in _field(resp, "segments", None) or []:
            text = (_field(seg, "text", "") or "").strip()
            if not text or (_field(seg, "no_speech_prob", 0) > 0.6 and _field(seg, "avg_logprob", 0) < -1.0):
                continue
            results.append({
                "start": min(chunk["start"] + _field(seg, "start"), chunk["end"]),
                "end": min(chunk["start"] + _field(seg, "end"), chunk["end"]),
                "text": text,
                "chunk": chunk["index"],
            })
        elapsed = time.perf_counter() - t0

        audio_len = chunk["end"] - chunk["start"]
        total_audio += audio_len
        total_elapsed += elapsed
        print(f"chunk {chunk['index']:03d}  audio={audio_len:6.1f}s  took={elapsed:6.1f}s  "
              f"rtf={elapsed / audio_len:.3f}  lang={language}")

        if on_progress:
            on_progress(i + 1, len(chunks))

    if total_audio:
        print(f"TOTAL  audio={total_audio:.1f}s  took={total_elapsed:.1f}s  "
              f"rtf={total_elapsed / total_audio:.3f}")
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
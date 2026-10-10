import json
import subprocess
from pathlib import Path
import re
from app.pipeline.transcribe import transcribe_chunks, warm_up, save_transcript, load_transcript

def cut_chunks(input_path:str, output_path:str, cuts) -> list[dict]:
    in_p, out_p = Path(input_path), Path(output_path)

    if not in_p.is_file():
       raise FileNotFoundError(f"Input file not found: {in_p}")

    if(len(cuts) == 0):
        raise ValueError("No cuts provided.")

    out_p.parent.mkdir(parents=True, exist_ok=True)
    results = []

    for i, (start, end) in enumerate(cuts):
        if(end <= start):
            raise ValueError(f"Invalid cut: start {start} >= end {end}")

        out_file = out_p / f"chunk_{i:03d}.wav"

        cmd = [
            "ffmpeg", "-nostdin", "-y",
            "-ss", f"{start:.3f}",
            "-i", str(in_p),
            "-t", f"{end - start:.3f}",
            "-c:a", "pcm_s16le",
            str(out_file),
        ]

        try:
            subprocess.run(
                cmd, capture_output=True, text=True, encoding="utf-8",
                errors="replace", check=True, timeout=600,
            )
        except subprocess.TimeoutExpired as e:
            raise RuntimeError(f"ffmpeg timed out after 600s") from e
        except FileNotFoundError as e:
            raise RuntimeError("ffmpeg not found. Install it and make sure it is on PATH.") from e
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"ffmpeg failed:\n{_tail(e.stderr)}") from e

        if not out_file.is_file() or out_file.stat().st_size < 1024:
            raise RuntimeError(f"Chunk {i} was not written correctly: {out_file}")

        results.append({"index": i, "path": out_file, "start": start, "end": end})

    return results

def plan_cuts (silences, duration:float, target_duration:float = 300, max_chunk:float = 420, min_chunk:float = 60, min_tail:float = 20) -> list[tuple[float, float]]:
    start = 0
    chunks = []
    candidates = []

    for a, b in silences:
        candidate = (a + b) /2
        if(0 < candidate < duration):
            candidates.append(candidate)
    candidates.sort()

    while duration - start > max_chunk:
        window = [c for c in candidates if start + min_chunk <= c <= start + max_chunk]
        if window:
            cut = min(window, key=lambda c: abs(c - (start + target_duration)))
        else:
            cut = start + max_chunk
        chunks.append((start, cut))
        start = cut
    
    chunks.append((start, duration))

    if len(chunks) > 1 and chunks[-1][1] - chunks[-1][0] < min_tail:
        _, last_end = chunks.pop()
        prev_start, _ = chunks.pop()
        chunks.append((prev_start, last_end))

    return chunks

def parse(stderr:str) -> list[tuple[float, float]]:
    silences = []
    pending_start = None

    start = re.compile(r"silence_start:\s*(-?[0-9.]+)")
    end = re.compile(r"silence_end:\s*(-?[0-9.]+)")

    for i in stderr.splitlines():
        m = start.search(i)
        if m:
            pending_start = float(m.group(1))
            continue
        m = end.search(i)
        if m and pending_start is not None:
            silences.append((pending_start, float(m.group(1))))
            pending_start = None

    return silences

def chunk_audio(input_path: str, output_dir: str, target=300, max_chunk=420, min_chunk=60) -> list[dict]:
    timeout = 600
    silence_threshold = 30
    min_silence_duration = 0.3
    in_p = Path(input_path)
    out_p = Path(output_dir)
    out_p.mkdir(parents=True, exist_ok=True)

    detect_silence_cmd = [
            "ffmpeg", "-nostdin", "-y",
            "-i", str(in_p), "-af", f"silencedetect=noise=-{silence_threshold}dB:d={min_silence_duration}",
            "-f", "null", "-", 
        ]
    try:
        res =subprocess.run(
            detect_silence_cmd, capture_output=True, text=True, encoding="utf-8", check=True, errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"ffmpeg timed out after {timeout} s") from e
    except FileNotFoundError as e:
        raise RuntimeError("ffmpeg not found. Install it and make sure it is on PATH.") from e
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffmpeg failed:\n{_tail(e.stderr)}") from e

    silences = parse(res.stderr)
    duration = probe(in_p)["duration"]
    cuts = plan_cuts(silences, duration, target, max_chunk, min_chunk)
    return cut_chunks(in_p, out_p, cuts)



def _tail(text: str, n: int = 5) -> str:
    return "\n".join((text or "").strip().splitlines()[-n:])


def normalize(input_path, output_path, timeout: int = 600) -> Path:
    in_p, out_p = Path(input_path), Path(output_path)

    if not in_p.is_file():
        raise FileNotFoundError(f"Input file not found: {in_p}")
    out_p.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-nostdin", "-y",
        "-i", str(in_p),
        "-vn", "-ac", "1", "-ar", "16000",
        "-c:a", "pcm_s16le",
        str(out_p),
    ]
    try:
        subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8",
            errors="replace", check=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"ffmpeg timed out after {timeout}s") from e
    except FileNotFoundError as e:
        raise RuntimeError("ffmpeg not found. Install it and make sure it is on PATH.") from e
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffmpeg failed:\n{_tail(e.stderr)}") from e

    return out_p


def probe(path) -> dict:
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=sample_rate,channels:format=duration",
        "-of", "json", str(path),
    ]
    try:
        res = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8",
            errors="replace", check=True, timeout=60,
        )
    except FileNotFoundError as e:
        raise RuntimeError("ffprobe not found. Install ffmpeg and make sure it is on PATH.") from e
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffprobe failed:\n{_tail(e.stderr)}") from e

    data = json.loads(res.stdout)
    streams = data.get("streams", [])
    if not streams:
        raise ValueError(f"No audio stream found in {path}")

    return {
        "sample_rate": int(streams[0]["sample_rate"]),
        "channels": int(streams[0]["channels"]),
        "duration": float(data["format"]["duration"]),
    }


if __name__ == "__main__":
    base = Path(__file__).resolve().parents[2]  # backend/
    src = base / "w.mp3"            # adjust to wherever your clip is
    wav = base / "tmp" / "baruu.wav"
    chunks_dir = base / "tmp" / "chunks"

    # remove stale chunks from earlier runs
    if chunks_dir.exists():
        for f in chunks_dir.glob("chunk_*.wav"):
            f.unlink()

    normalize(src, wav)
    total = probe(wav)["duration"]
    print(f"Original duration: {total:.3f}s")

    # small sizes so a short clip produces several chunks
    chunks = chunk_audio(wav, chunks_dir, target=30, max_chunk=45, min_chunk=10)
    print(f"{len(chunks)} chunks planned")

    # 1. file count matches the plan
    files = sorted(chunks_dir.glob("chunk_*.wav"))
    assert len(files) == len(chunks), f"{len(files)} files vs {len(chunks)} cuts"

    # 2. each chunk's real duration matches its planned length
    actual_sum = 0.0
    for c in chunks:
        expected = c["end"] - c["start"]
        actual = probe(c["path"])["duration"]
        actual_sum += actual
        print(f"chunk {c['index']:03d}  start={c['start']:7.2f}  end={c['end']:7.2f}  "
              f"expected={expected:7.3f}  actual={actual:7.3f}")
        assert abs(actual - expected) < 0.05, f"chunk {c['index']} duration mismatch"

    # 3. chunks are contiguous and cover the whole file
    assert chunks[0]["start"] == 0
    assert abs(chunks[-1]["end"] - total) < 0.1
    for a, b in zip(chunks, chunks[1:]):
        assert a["end"] == b["start"], f"gap or overlap after chunk {a['index']}"

    # 4. durations add up to the original
    assert abs(actual_sum - total) < 0.1, f"sum {actual_sum:.3f} vs original {total:.3f}"

    print("All checks passed. Now listen to a few chunk boundaries.")

    warm_up()
    segs = transcribe_chunks(chunks, language="en")

    out_file = save_transcript(segs, base / "tmp" / "transcript.json")
    assert load_transcript(out_file) == segs
    print("Saved:", out_file)

    for s in segs[:10]:
        print(f"[{s['start']:7.2f} -> {s['end']:7.2f}] (chunk {s['chunk']}) {s['text']}")

    # timestamps must never go backward
    assert all(a["start"] <= b["start"] for a, b in zip(segs, segs[1:])), "timestamps out of order"
    # last segment should end near the full duration
    print("last segment ends at", segs[-1]["end"], "of", total)
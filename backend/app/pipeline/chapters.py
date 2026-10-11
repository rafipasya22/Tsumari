import json
import re
from functools import lru_cache
from pathlib import Path

import numpy as np
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
LLM_MODEL = os.getenv("GROQ_MODEL")

def save_json(obj, path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    return path


def mmss(t: float) -> str:
    return f"{int(t) // 60:02d}:{int(t) % 60:02d}"


def clean_segments(segments: list[dict]) -> list[dict]:
    out, prev = [], None
    for s in segments:
        text = s["text"].strip()
        if not text or text == prev:
            continue
        out.append({**s, "text": text})
        prev = text
    return out


def make_windows(segments: list[dict], window_len: float = 30.0) -> list[dict]:
    SENT_END = re.compile(r"[.!?…][\"')\]]*$")
    
    def build(segs):
        return {
            "start": segs[0]["start"],
            "end": segs[-1]["end"],
            "text": " ".join(s["text"] for s in segs),
        }

    windows, cur = [], []
    for s in segments:
        cur.append(s)
        
        length = s["end"] - cur[0]["start"]
        if length >= window_len and (SENT_END.search(s["text"]) or length >= window_len * 1.5):
            windows.append(build(cur))
            cur = []
    if cur:
        tail = build(cur)
        if windows and tail["end"] - tail["start"] < window_len / 2:
            windows[-1]["end"] = tail["end"]          
            windows[-1]["text"] += " " + tail["text"]
        else:
            windows.append(tail)
    return windows


@lru_cache(maxsize=1)
def get_embedder():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(EMBED_MODEL, device="cpu")


def embed(texts: list[str]) -> np.ndarray:
    return get_embedder().encode(texts, normalize_embeddings=True, show_progress_bar=False)


def gap_scores(emb: np.ndarray, k: int = 2) -> np.ndarray:
    scores = []
    for i in range(1, len(emb)):
        left = emb[max(0, i - k):i].mean(axis=0)
        right = emb[i:i + k].mean(axis=0)
        scores.append(float(left @ right / (np.linalg.norm(left) * np.linalg.norm(right))))
    return np.array(scores)


def depth_scores(scores: np.ndarray) -> np.ndarray:
    if len(scores) >= 3:
        padded = np.pad(scores, 1, mode="edge")
        s = np.convolve(padded, np.ones(3) / 3, mode="valid")  
    else:
        s = scores
    depth = np.zeros(len(s))
    for i in range(len(s)):
        l = i
        while l > 0 and s[l - 1] >= s[l]:
            l -= 1
        r = i
        while r < len(s) - 1 and s[r + 1] >= s[r]:
            r += 1
        depth[i] = (s[l] - s[i]) + (s[r] - s[i])
    return depth


def pick_boundaries(windows, scores, min_chapter, max_chapters, sensitivity) -> list[int]:
    depth = depth_scores(scores)
    if len(depth) == 0:
        return []
    thresh = depth.mean() + sensitivity * depth.std()
    t_start, t_end = windows[0]["start"], windows[-1]["end"]

    chosen, times = [], []
    for j in np.argsort(-depth):                      
        if depth[j] < thresh or len(chosen) >= max_chapters - 1:
            break
        t = windows[j + 1]["start"]
        if t - t_start < min_chapter or t_end - t < min_chapter:
            continue
        if any(abs(t - u) < min_chapter for u in times):
            continue
        chosen.append(int(j))
        times.append(t)
    return sorted(chosen)


@lru_cache(maxsize=1)
def _client():
    from groq import Groq
    return Groq()


def _ask_json(prompt: str, retries: int = 1) -> dict | None:
    if not LLM_MODEL:
        raise RuntimeError("Set GROQ_MODEL in .env to a model your account can access.")
    for _ in range(retries + 1):
        resp = _client().chat.completions.create(
            model=LLM_MODEL,
            max_tokens=2000,
            temperature=0.2,
            reasoning_effort="low",
            messages=[{"role": "user", "content": prompt}],
        )
        content = resp.choices[0].message.content or ""
        m = re.search(r"\{.*\}", content, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    return None


def title_and_summary(text: str, n: int) -> dict:
    prompt = (
        "Below is a transcript excerpt from one chapter of a podcast or lecture.\n"
        "Reply with ONLY a JSON object: {\"title\": ..., \"summary\": ...}\n"
        "- title: at most 8 words\n"
        "- summary: 2-3 sentences, using only information in the excerpt\n"
        "- write in the same language as the transcript\n\n"
        "- keep the title neutral and professional; do not copy profanity\n"
        "- do not assume the speaker's gender; say 'the speaker'\n"
        "- state only what the excerpt says; add nothing else\n"
        f"TRANSCRIPT:\n{text[:12000]}"
    )
    out = _ask_json(prompt)
    if not out or "title" not in out:
        return {"title": f"Chapter {n}", "summary": ""}
    return {"title": str(out["title"]).strip(), "summary": str(out.get("summary", "")).strip()}


def make_tldr(chapters: list[dict]) -> str:
    listing = "\n".join(f"- {c['title']}: {c['summary']}" for c in chapters)
    prompt = (
        "Below are chapter titles and summaries of a podcast or lecture.\n"
        "Reply with ONLY a JSON object: {\"tldr\": ...} where tldr is a 3-4 sentence overview, "
        "in the same language as the chapters.\n\n" + listing
    )
    out = _ask_json(prompt)
    return str(out["tldr"]).strip() if out and "tldr" in out else ""


def build_chapters(
    segments: list[dict],
    window_len: float = 30.0,
    min_chapter: float = 120.0,
    max_chapters: int = 20,
    sensitivity: float = 0.5,
    use_llm: bool = True,
) -> dict:
    segments = clean_segments(segments)
    if not segments:
        raise ValueError("Transcript is empty.")

    windows = make_windows(segments, window_len)
    if len(windows) >= 3:
        emb = embed([w["text"] for w in windows])
        scores = gap_scores(emb)
        gaps = pick_boundaries(windows, scores, min_chapter, max_chapters, sensitivity)
    else:
        gaps = []

    starts = [0] + [j + 1 for j in gaps]              
    ends = starts[1:] + [len(windows)]

    chapters = []
    for n, (a, b) in enumerate(zip(starts, ends), start=1):
        group = windows[a:b]
        text = " ".join(w["text"] for w in group)
        meta = title_and_summary(text, n) if use_llm else {"title": f"Chapter {n}", "summary": ""}
        chapters.append({
            "index": n - 1,
            "start": group[0]["start"],
            "end": group[-1]["end"],
            **meta,
        })

    return {"tldr": make_tldr(chapters) if use_llm else "", "chapters": chapters}
    
def show_boundaries(segs, chapters, radius=10):
    for c in chapters[1:]:
        t = c["start"]
        print(f"\n--- boundary at {mmss(t)} ---")
        for s in segs:
            if t - radius <= s["start"] <= t + radius:
                mark = ">>" if s["start"] >= t else "  "
                print(f"{mark} [{mmss(s['start'])}] {s['text']}")

if __name__ == "__main__":
    base = Path(__file__).resolve().parents[2]  
    with (base / "tmp" / "transcript.json").open(encoding="utf-8") as f:
        segs = json.load(f)

    result = build_chapters(segs, window_len=20, min_chapter=60, use_llm=True)

    print("TLDR:", result["tldr"], "\n")
    for c in result["chapters"]:
        print(f"[{mmss(c['start'])} - {mmss(c['end'])}] {c['title']}\n    {c['summary']}")

    show_boundaries(segs, result["chapters"])
    save_json(result, base / "tmp" / "chapters.json")
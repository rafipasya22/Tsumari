from pathlib import Path

import yt_dlp

from app.core.settings import settings

MAX_SECONDS = 3 * 60 * 60


def download_audio(video_id: str, dest_dir: Path) -> tuple[Path, str | None]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    url = f"https://www.youtube.com/watch?v={video_id}"
    opts = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": str(dest_dir / "input.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "max_filesize": settings.max_upload_mb * 1024 * 1024,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if info.get("is_live"):
            raise RuntimeError("Live streams aren't supported.")
        if (info.get("duration") or 0) > MAX_SECONDS:
            raise RuntimeError("Video is longer than 3 hours.")
        ydl.process_ie_result(info, download=True)

    path = next(dest_dir.glob("input.*"), None)
    if path is None:
        raise RuntimeError("Download finished but no audio file was found.")
    return path, (info.get("title") or "")[:200] or None
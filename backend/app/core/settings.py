from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    supabase_url: str
    supabase_service_key: str
    jobs_dir: Path = BACKEND_DIR / "tmp" / "jobs"
    max_upload_mb: int = 200
    allowed_exts: set[str] = {".mp3", ".wav", ".m4a", ".mp4", ".ogg", ".flac", ".aac", ".webm"}


settings = Settings()
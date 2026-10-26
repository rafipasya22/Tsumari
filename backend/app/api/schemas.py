from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class JobCreated(BaseModel):
    id: UUID
    status: Literal["queued", "running", "done", "failed"]


class JobStatus(BaseModel):
    id: UUID
    status: Literal["queued", "running", "done", "failed"]
    stage: str | None = None
    progress: float = 0
    filename: str | None = None
    error: str | None = None
    result: dict | None = None
    created_at: datetime
    updated_at: datetime
    youtube_id: str | None = None
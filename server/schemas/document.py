import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    original_filename: str
    stored_filename: str
    content_type: str | None
    size_bytes: int
    storage_path: str
    status: str
    stage: str
    error_message: str | None
    retry_count: int
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

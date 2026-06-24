from typing import Any

from pydantic import BaseModel, Field


class RetrievalQueryRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=3, ge=1, le=20)


class RetrievalSource(BaseModel):
    document_id: str | None = None
    original_filename: str | None = None
    chunk_index: int | None = None
    content_types: list[str] = Field(default_factory=list)
    table_count: int = 0
    image_count: int = 0
    text_length: int = 0
    content_preview: str
    tables_html: list[str] = Field(default_factory=list)
    images_base64: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RetrievalSearchResponse(BaseModel):
    query: str
    sources: list[RetrievalSource]


class RetrievalAskResponse(BaseModel):
    query: str
    answer: str
    sources: list[RetrievalSource]

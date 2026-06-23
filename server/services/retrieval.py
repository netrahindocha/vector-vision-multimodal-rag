import json
import uuid
from typing import Any

from langchain_core.documents import Document as LangChainDocument

from database import SessionLocal
from models import DocumentChunk, DocumentPartitionItem
from rag.pipeline import generate_final_answer, load_existing_vector_store


class VectorStoreUnavailableError(RuntimeError):
    pass


def _parse_content_types(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except json.JSONDecodeError:
            return [item.strip() for item in value.split(",") if item.strip()]
    return []


def _parse_original_content(metadata: dict[str, Any]) -> dict[str, Any]:
    original_content = metadata.get("original_content")
    if not isinstance(original_content, str):
        return {}

    try:
        parsed = json.loads(original_content)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _content_preview(chunk: LangChainDocument, original_content: dict[str, Any]) -> str:
    raw_text = original_content.get("raw_text")
    preview_source = raw_text if isinstance(raw_text, str) and raw_text else chunk.page_content
    return preview_source[:500]


def build_source(chunk: LangChainDocument) -> dict[str, Any]:
    metadata = dict(chunk.metadata or {})
    original_content = _parse_original_content(metadata)

    sanitized_metadata = {
        key: value for key, value in metadata.items() if key != "original_content"
    }

    return {
        "document_id": metadata.get("document_id"),
        "original_filename": metadata.get("original_filename"),
        "chunk_index": _safe_int(metadata.get("chunk_index"))
        if metadata.get("chunk_index") is not None
        else None,
        "content_types": _parse_content_types(metadata.get("content_types")),
        "table_count": _safe_int(metadata.get("table_count")),
        "image_count": _safe_int(metadata.get("image_count")),
        "text_length": _safe_int(metadata.get("text_length")),
        "content_preview": _content_preview(chunk, original_content),
        "metadata": sanitized_metadata,
    }


def retrieve_workspace_chunks(
    workspace_id: uuid.UUID | str,
    query: str,
    top_k: int = 3,
) -> list[LangChainDocument]:
    vectorstore = load_existing_vector_store()
    if vectorstore is None:
        raise VectorStoreUnavailableError("Vector store is not available")

    return vectorstore.similarity_search(
        query,
        k=top_k,
        filter={"workspace_id": str(workspace_id)},
    )


def search_workspace(
    workspace_id: uuid.UUID | str,
    query: str,
    top_k: int = 3,
) -> dict[str, Any]:
    chunks = retrieve_workspace_chunks(workspace_id, query, top_k)
    return {
        "query": query,
        "sources": [build_source(chunk) for chunk in chunks],
    }


def answer_workspace_query(
    workspace_id: uuid.UUID | str,
    query: str,
    top_k: int = 3,
) -> dict[str, Any]:
    chunks = retrieve_workspace_chunks(workspace_id, query, top_k)
    answer = generate_final_answer(chunks, query)
    return {
        "query": query,
        "answer": answer,
        "sources": [build_source(chunk) for chunk in chunks],
    }


def get_document_partition_items(
    workspace_id: uuid.UUID | str,
    document_id: uuid.UUID | str,
    content_type: str = "all",
) -> dict[str, Any]:
    with SessionLocal() as db:
        query = db.query(DocumentPartitionItem).filter(
            DocumentPartitionItem.workspace_id == uuid.UUID(str(workspace_id)),
            DocumentPartitionItem.document_id == uuid.UUID(str(document_id)),
        )
        if content_type != "all":
            query = query.filter(DocumentPartitionItem.content_type == content_type)

        items = query.order_by(DocumentPartitionItem.element_index).all()

        return {
            "workspace_id": str(workspace_id),
            "document_id": str(document_id),
            "content_type": content_type,
            "items": [
                {
                    "id": str(item.id),
                    "element_index": item.element_index,
                    "content_type": item.content_type,
                    "element_type": item.element_type,
                    "category": item.category,
                    "text": item.text,
                    "table_html": item.table_html,
                    "image_base64": item.image_base64,
                    "metadata": item.element_metadata or {},
                }
                for item in items
            ],
        }


def get_document_chunks(
    workspace_id: uuid.UUID | str,
    document_id: uuid.UUID | str,
) -> dict[str, Any]:
    with SessionLocal() as db:
        rows = (
            db.query(DocumentChunk)
            .filter(
                DocumentChunk.workspace_id == uuid.UUID(str(workspace_id)),
                DocumentChunk.document_id == uuid.UUID(str(document_id)),
            )
            .order_by(DocumentChunk.chunk_index)
            .all()
        )

        return {
            "workspace_id": str(workspace_id),
            "document_id": str(document_id),
            "chunks": [
                {
                    "chunk_index": chunk.chunk_index,
                    "content_types": chunk.content_types or [],
                    "raw_text": chunk.raw_text or "",
                    "tables_html": chunk.tables_html or [],
                    "images_base64": chunk.images_base64 or [],
                    "enhanced_content": chunk.enhanced_content or "",
                    "metadata": chunk.chunk_metadata or {},
                }
                for chunk in rows
            ],
        }

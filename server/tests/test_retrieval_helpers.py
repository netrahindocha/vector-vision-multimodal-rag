import json
from types import SimpleNamespace

from services import retrieval


def test_parse_content_types_from_list():
    assert retrieval._parse_content_types(["text", "table", 3]) == ["text", "table", "3"]


def test_parse_content_types_from_json_string():
    assert retrieval._parse_content_types('["text", "image"]') == ["text", "image"]


def test_parse_content_types_from_comma_separated_string():
    assert retrieval._parse_content_types("text, table, image") == ["text", "table", "image"]


def test_parse_original_content_returns_empty_dict_for_invalid_payloads():
    assert retrieval._parse_original_content({}) == {}
    assert retrieval._parse_original_content({"original_content": "not-json"}) == {}
    assert retrieval._parse_original_content({"original_content": "[]"}) == {}


def test_content_preview_prefers_original_raw_text_over_page_content():
    chunk = SimpleNamespace(page_content="enhanced summary")
    original_content = {"raw_text": "original raw text"}

    assert retrieval._content_preview(chunk, original_content) == "original raw text"


def test_build_source_sanitizes_original_content_and_extracts_counts():
    original_content = {
        "raw_text": "This is the raw text.",
        "tables_html": ["<table></table>"],
        "images_base64": ["abc123"],
    }
    chunk = SimpleNamespace(
        page_content="enhanced searchable content",
        metadata={
            "document_id": "doc-1",
            "original_filename": "report.pdf",
            "chunk_index": "2",
            "page_number": "5",
            "content_types": json.dumps(["text", "table", "image"]),
            "table_count": "1",
            "image_count": "1",
            "text_length": "22",
            "original_content": json.dumps(original_content),
            "safe_metadata": "kept",
        },
    )

    source = retrieval.build_source(chunk)

    assert source["document_id"] == "doc-1"
    assert source["original_filename"] == "report.pdf"
    assert source["chunk_index"] == 2
    assert source["page_number"] == 5
    assert source["content_types"] == ["text", "table", "image"]
    assert source["table_count"] == 1
    assert source["image_count"] == 1
    assert source["text_length"] == 22
    assert source["content_preview"] == "This is the raw text."
    assert source["tables_html"] == ["<table></table>"]
    assert source["images_base64"] == ["abc123"]
    assert source["metadata"]["safe_metadata"] == "kept"
    assert "original_content" not in source["metadata"]


def test_answer_workspace_query_short_circuits_when_no_chunks(monkeypatch):
    monkeypatch.setattr(retrieval, "retrieve_workspace_chunks", lambda workspace_id, query, top_k: [])

    response = retrieval.answer_workspace_query("workspace-1", "anything", top_k=3)

    assert response == {
        "query": "anything",
        "answer": retrieval.NO_RELEVANT_CONTEXT_ANSWER,
        "sources": [],
    }


def test_answer_workspace_query_generates_answer_and_sources(monkeypatch):
    chunk = SimpleNamespace(page_content="content", metadata={"original_content": json.dumps({"raw_text": "content"})})
    monkeypatch.setattr(retrieval, "retrieve_workspace_chunks", lambda workspace_id, query, top_k: [chunk])
    monkeypatch.setattr(retrieval, "generate_final_answer", lambda chunks, query: "Generated answer")

    response = retrieval.answer_workspace_query("workspace-1", "question", top_k=3)

    assert response["query"] == "question"
    assert response["answer"] == "Generated answer"
    assert len(response["sources"]) == 1
    assert response["sources"][0]["content_preview"] == "content"

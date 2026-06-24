import json
import os
from pathlib import Path
from typing import List, Optional

from unstructured.partition.pdf import partition_pdf
from unstructured.chunking.title import chunk_by_title

from langchain_core.documents import Document
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv
import chromadb

load_dotenv()


def get_chroma_client():
    chroma_host = os.getenv("CHROMA_HOST")
    if not chroma_host:
        return None

    chroma_port = int(os.getenv("CHROMA_PORT", "8000"))
    return chromadb.HttpClient(host=chroma_host, port=chroma_port)


def get_chroma_collection_name() -> str:
    return os.getenv("CHROMA_COLLECTION_NAME", "rag_documents")


def partition_document(file_path: str):
    print(f"Partitioning document: {file_path}")

    elements = partition_pdf(
        filename=file_path,
        strategy="hi_res",
        infer_table_structure=True,
        extract_image_block_types=["Image"],
        extract_image_block_to_payload=True,
    )

    print(f"Extracted {len(elements)} elements")
    return elements


def create_chunks_by_title(elements):
    print("Creating smart chunks....")

    chunks = chunk_by_title(
        elements,
        max_characters=3000,
        new_after_n_chars=2400,
        combine_text_under_n_chars=500,
    )

    print(f"Created {len(chunks)} chunks")
    return chunks


def separate_content_types(chunk):
    content_data = {
        "text": chunk.text,
        "tables": [],
        "images": [],
        "types": ["text"],
    }

    if hasattr(chunk, "metadata") and hasattr(chunk.metadata, "orig_elements"):
        for element in chunk.metadata.orig_elements:
            element_type = type(element).__name__

            if element_type == "Table":
                content_data["types"].append("table")
                table_html = getattr(element.metadata, "text_as_html", element.text)
                content_data["tables"].append(table_html)

            if element_type == "Image":
                if hasattr(element, "metadata") and hasattr(element.metadata, "image_base64"):
                    content_data["types"].append("image")
                    content_data["images"].append(element.metadata.image_base64)

    content_data["types"] = list(set(content_data["types"]))
    return content_data


def create_ai_enhanced_summary(text: str, tables: List[str], images: List[str]) -> tuple[str, str]:
    try:
        llm = ChatOpenAI(model="gpt-4o", temperature=0)
        prompt_text = f"""You are creating a searchable multimodal summary for document retrieval.

CONTENT TO ANALYZE:

TEXT CONTENT:
{text or "No text content available."}

"""

        if tables:
            prompt_text += "TABLES:\n"
            for i, table in enumerate(tables):
                prompt_text += f"Table {i + 1}:\n{table}\n\n"

        if images:
            prompt_text += f"IMAGES:\nThere are {len(images)} image(s) attached. Analyze the visual content carefully.\n\n"

        prompt_text += """
YOUR TASK:
Generate a comprehensive, searchable summary that covers:
1. Key facts, numbers, and data points from text, tables, and images
2. Main topics and concepts discussed
3. Important visual observations from images, diagrams, charts, or screenshots
4. Questions this content could answer
5. Alternative search terms users might use

Do not simply copy the raw text. Return only the generated summary.
"""

        message_content = [{"type": "text", "text": prompt_text}]

        for image_base64 in images:
            message_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                }
            )

        message = HumanMessage(content=message_content)
        response = llm.invoke([message])

        return response.content, "ai_generated"

    except Exception as err:
        print(f"Error: AI Summary Failed, message: {err}")
        summary = f"{text[:300]}..."
        if tables:
            summary += f"   [Contains {len(tables)} table(s)]"
        if images:
            summary += f"   [Contains {len(images)} image(s)]"
        return summary, "fallback"


def extract_page_number(chunk) -> int | None:
    page_numbers = []

    metadata = getattr(chunk, "metadata", None)
    direct_page_number = getattr(metadata, "page_number", None) if metadata else None
    if direct_page_number is not None:
        page_numbers.append(direct_page_number)

    orig_elements = getattr(metadata, "orig_elements", []) if metadata else []
    for element in orig_elements:
        element_metadata = getattr(element, "metadata", None)
        page_number = getattr(element_metadata, "page_number", None) if element_metadata else None
        if page_number is not None:
            page_numbers.append(page_number)

    normalized_pages = []
    for page_number in page_numbers:
        try:
            normalized_pages.append(int(page_number))
        except (TypeError, ValueError):
            continue

    return min(normalized_pages) if normalized_pages else None


def analyze_chunk_content(chunk) -> dict:
    content_data = separate_content_types(chunk)
    page_number = extract_page_number(chunk)
    is_multimodal = bool(content_data["tables"] or content_data["images"])

    analyzed = {
        "raw_text": content_data["text"],
        "tables_html": content_data["tables"],
        "images_base64": content_data["images"],
        "content_types": content_data["types"],
        "table_count": len(content_data["tables"]),
        "image_count": len(content_data["images"]),
        "text_length": len(content_data["text"] or ""),
        "is_multimodal": is_multimodal,
    }
    if page_number is not None:
        analyzed["page_number"] = page_number

    return analyzed


def summarize_one_chunk(chunk, index: int = 0, total_chunks: int = 1):
    current_chunk = index + 1
    print(f"Processing chunk {current_chunk}/{total_chunks}")

    chunk_content = analyze_chunk_content(chunk)

    print(f"Types found: {chunk_content['content_types']}")
    print(f"Tables: {chunk_content['table_count']}, Images: {chunk_content['image_count']}")

    if chunk_content["is_multimodal"]:
        print(f"\nCreating AI summary for mixed content...")
        enhanced_content, summary_status = create_ai_enhanced_summary(
            chunk_content["raw_text"],
            chunk_content["tables_html"],
            chunk_content["images_base64"],
        )
        print(f"\nSummary status: {summary_status}")
        print(f"\nEnhanced content preview: {enhanced_content[:200]}...")
    else:
        print(f"Using raw text (no tables/images)")
        enhanced_content = chunk_content["raw_text"]
        summary_status = "raw_text"

    metadata = {
        "original_content": json.dumps(
            {
                "raw_text": chunk_content["raw_text"],
                "tables_html": chunk_content["tables_html"],
                "images_base64": chunk_content["images_base64"],
            }
        ),
        "content_types": json.dumps(chunk_content["content_types"]),
        "table_count": chunk_content["table_count"],
        "image_count": chunk_content["image_count"],
        "text_length": chunk_content["text_length"],
        "summary_status": summary_status,
        "is_multimodal": chunk_content["is_multimodal"],
    }
    if chunk_content.get("page_number") is not None:
        metadata["page_number"] = chunk_content["page_number"]

    return Document(
        page_content=enhanced_content,
        metadata=metadata,
    )


def summarize_chunks(chunks):
    print("Processing chunks with AI Summaries...")

    langchain_documents = []
    total_chunks = len(chunks)

    for i, chunk in enumerate(chunks):
        langchain_documents.append(summarize_one_chunk(chunk, i, total_chunks))

    print(f"Processed {len(langchain_documents)} chunks")
    return langchain_documents


def export_chunks_to_json(chunks, filename="chunks_export.json"):
    export_data = []

    for i, doc in enumerate(chunks):
        chunk_data = {
            "chunk_id": i + 1,
            "enhanced_content": doc.page_content,
            "metadata": {
                "original_content": json.loads(doc.metadata.get("original_content", "{}"))
            },
        }
        export_data.append(chunk_data)

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False)

    print(f"Exported {len(export_data)} chunks to {filename}")
    return export_data


def create_vector_store(documents: List[Document], persist_directory: str = "db/chroma_db"):
    print("Creating embeddings and storing in ChromaDB...")

    embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")
    chroma_client = get_chroma_client()
    collection_name = get_chroma_collection_name()

    chroma_kwargs = {
        "documents": documents,
        "embedding": embedding_model,
        "collection_name": collection_name,
        "collection_metadata": {"hnsw:space": "cosine"},
    }

    if chroma_client:
        chroma_kwargs["client"] = chroma_client
        storage_location = f"Chroma service at {os.getenv('CHROMA_HOST')}:{os.getenv('CHROMA_PORT', '8000')}"
    else:
        chroma_kwargs["persist_directory"] = persist_directory
        storage_location = persist_directory

    print("\nCreating Vector Store")
    vectorstore = Chroma.from_documents(**chroma_kwargs)
    print("\nFinished creating vector store")

    print(f"Vector store created and saved to {storage_location}")

    return vectorstore


def load_existing_vector_store(persist_directory: str = "db/chroma_db") -> Optional[Chroma]:
    embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")
    chroma_client = get_chroma_client()
    collection_name = get_chroma_collection_name()

    if chroma_client:
        return Chroma(
            client=chroma_client,
            collection_name=collection_name,
            embedding_function=embedding_model,
        )

    chroma_dir = Path(persist_directory)
    if not chroma_dir.exists():
        return None

    vectorstore = Chroma(
        persist_directory=persist_directory,
        collection_name=collection_name,
        embedding_function=embedding_model,
    )
    return vectorstore


def generate_final_answer(chunks, user_query):
    try:
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt_text = f"""Based on the following documents, please answer this question: {user_query}

CONTENT TO ANALYZE:
"""

        for i, chunk in enumerate(chunks):
            prompt_text += f"--- Document {i + 1} ---\n"

            if "original_content" in chunk.metadata:
                original_data = json.loads(chunk.metadata["original_content"])

                raw_text = original_data.get("raw_text", "")
                if raw_text:
                    prompt_text += f"TEXT:\n{raw_text}\n\n"

                tables_html = original_data.get("tables_html", [])
                if tables_html:
                    prompt_text += "TABLES:\n"
                    for j, table in enumerate(tables_html):
                        prompt_text += f"Table {j+1}:\n{table}\n\n"

                prompt_text += "\n"

        prompt_text += """
Please provide a clear, comprehensive answer using the text, tables, and images above.

If the retrieved content directly answers the user's question, answer it clearly and cite the relevant facts.

If the retrieved content is related but does not directly answer the user's question, use this response format:
"I could not find a direct answer to your question: '<user question>'. However, the retrieved documents do contain related information about <briefly list related topics or facts found>. This related information may be useful, but it does not directly answer the exact question asked."

If the retrieved content is unrelated to the user's question, say exactly:
"I could not find relevant information in the retrieved documents to answer your question."

ANSWER:"""

        message_content = [{"type": "text", "text": prompt_text}]

        for chunk in chunks:
            if "original_content" in chunk.metadata:
                original_data = json.loads(chunk.metadata["original_content"])
                images_base64 = original_data.get("images_base64", [])

                for image_base64 in images_base64:
                    message_content.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                        }
                    )

        message = HumanMessage(content=message_content)
        response = llm.invoke([message])

        return response.content

    except Exception as err:
        print(f"Error: Answer generation failed, message: {err}")
        return "Sorry, I encountered an error while generating the answer."

from celery_app import celery_app
from services.ingestion import process_document_ingestion


@celery_app.task(name="documents.process_ingestion")
def process_document_ingestion_task(document_id: str) -> None:
    process_document_ingestion(document_id)

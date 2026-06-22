import os

from celery import Celery

celery_app = Celery(
    "rag_worker",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/1"),
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Import task modules so Celery registers them when the app starts.
import tasks.ingestion_tasks  # noqa: E402,F401

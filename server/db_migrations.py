from sqlalchemy import text

from database import engine


def ensure_document_status_columns() -> None:
    """Lightweight dev migration until Alembic migrations are added."""
    statements = [
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'queued'",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS stage VARCHAR(100) NOT NULL DEFAULT 'uploaded'",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
        "CREATE INDEX IF NOT EXISTS ix_documents_status ON documents (status)",
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

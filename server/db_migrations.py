from sqlalchemy import text

from database import engine


def ensure_document_status_columns() -> None:
    """Lightweight dev migration until Alembic migrations are added."""
    statements = [
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'queued'",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS stage VARCHAR(100) NOT NULL DEFAULT 'uploaded'",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_metadata JSONB",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
        "CREATE INDEX IF NOT EXISTS ix_documents_status ON documents (status)",
    ]

    partition_item_statements = [
        "CREATE TABLE IF NOT EXISTS document_partition_items ("
        "id UUID PRIMARY KEY, "
        "document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE, "
        "workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, "
        "element_index INTEGER NOT NULL, "
        "content_type VARCHAR(50) NOT NULL, "
        "element_type VARCHAR(100) NOT NULL, "
        "category VARCHAR(100), "
        "text TEXT, "
        "table_html TEXT, "
        "image_base64 TEXT, "
        "element_metadata JSONB, "
        "created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()"
        ")",
        "CREATE INDEX IF NOT EXISTS ix_document_partition_items_document_id ON document_partition_items (document_id)",
        "CREATE INDEX IF NOT EXISTS ix_document_partition_items_workspace_id ON document_partition_items (workspace_id)",
        "CREATE INDEX IF NOT EXISTS ix_document_partition_items_content_type ON document_partition_items (content_type)",
        "CREATE INDEX IF NOT EXISTS ix_document_partition_items_category ON document_partition_items (category)",
    ]

    with engine.begin() as connection:
        for statement in [*statements, *partition_item_statements]:
            connection.execute(text(statement))

from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from database import Base, engine
from db_migrations import ensure_document_status_columns
from routers.documents import router as documents_router
from routers.workspaces import router as workspaces_router
from services.ingestion import start_pending_document_recovery

# Import models so SQLAlchemy registers tables before create_all().
import models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_document_status_columns()
    start_pending_document_recovery()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(workspaces_router)
app.include_router(documents_router)


@app.get("/")
async def root():
    return {"message": "RAG API is running"}


@app.get("/health/db")
def database_health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}

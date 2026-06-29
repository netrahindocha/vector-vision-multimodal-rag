from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import Base, engine
from db_migrations import ensure_document_status_columns
from routers.auth import router as auth_router
from routers.documents import router as documents_router
from routers.retrieval import router as retrieval_router
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


app = FastAPI(
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(workspaces_router)
app.include_router(documents_router)
app.include_router(retrieval_router)


@app.get("/")
async def root():
    return {"message": "RAG API is running"}


@app.get("/health/db")
def database_health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}

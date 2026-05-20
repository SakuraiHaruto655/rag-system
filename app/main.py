from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.models import ChatRequest, ChatResponse, IngestRequest, IngestResponse
from app.rag import RagService


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Local Knowledge RAG", version="1.0.0")


@lru_cache
def get_rag_service() -> RagService:
    return RagService(get_settings())


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/ingest", response_model=IngestResponse)
def ingest(request: IngestRequest) -> IngestResponse:
    settings = get_settings()
    knowledge_dir = Path(request.knowledge_dir) if request.knowledge_dir else settings.knowledge_dir

    if not knowledge_dir.exists():
        raise HTTPException(status_code=400, detail=f"Knowledge directory not found: {knowledge_dir}")

    if request.chunk_overlap >= request.chunk_size:
        raise HTTPException(status_code=400, detail="chunk_overlap must be smaller than chunk_size")

    try:
        files, chunks = get_rag_service().ingest(
            knowledge_dir=knowledge_dir,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return IngestResponse(files=files, chunks=chunks, collection=settings.chroma_collection)


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        answer, sources = get_rag_service().answer(request.question, request.top_k)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ChatResponse(answer=answer, sources=sources)


app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

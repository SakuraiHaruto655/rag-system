from __future__ import annotations

import hashlib
from pathlib import Path

import chromadb
from openai import OpenAI

from app.config import Settings
from app.models import Source


SUPPORTED_EXTENSIONS = {".md", ".markdown", ".txt"}


class RagService:
    def __init__(self, settings: Settings):
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set.")

        self.settings = settings
        self.openai = OpenAI(api_key=settings.openai_api_key)
        settings.chroma_dir.mkdir(parents=True, exist_ok=True)
        self.chroma = chromadb.PersistentClient(path=str(settings.chroma_dir))
        self.collection = self.chroma.get_or_create_collection(name=settings.chroma_collection)

    def ingest(self, knowledge_dir: Path, chunk_size: int, chunk_overlap: int) -> tuple[int, int]:
        files = list(iter_knowledge_files(knowledge_dir))
        total_chunks = 0

        for file_path in files:
            text = file_path.read_text(encoding="utf-8")
            chunks = split_text(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            if not chunks:
                continue

            ids = [make_chunk_id(file_path, idx, chunk) for idx, chunk in enumerate(chunks)]
            embeddings = self.embed(chunks)
            metadatas = [{"file": str(file_path), "chunk": idx} for idx in range(len(chunks))]

            self.collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=chunks,
                metadatas=metadatas,
            )
            total_chunks += len(chunks)

        return len(files), total_chunks

    def answer(self, question: str, top_k: int) -> tuple[str, list[Source]]:
        question_embedding = self.embed([question])[0]
        results = self.collection.query(
            query_embeddings=[question_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        sources = [
            Source(
                file=str(metadata.get("file", "")),
                chunk=int(metadata.get("chunk", 0)),
                distance=float(distance) if distance is not None else None,
                content=document,
            )
            for document, metadata, distance in zip(documents, metadatas, distances, strict=False)
        ]

        context = format_context(sources)
        response = self.openai.chat.completions.create(
            model=self.settings.openai_chat_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "あなたは社内ナレッジに基づいて回答するアシスタントです。"
                        "添付された検索結果だけを根拠に日本語で簡潔に回答してください。"
                        "根拠が不足している場合は、不足していると伝えてください。"
                    ),
                },
                {
                    "role": "user",
                    "content": f"質問:\n{question}\n\n検索結果:\n{context}",
                },
            ],
            temperature=0.2,
        )

        answer = response.choices[0].message.content or ""
        return answer, sources

    def embed(self, texts: list[str]) -> list[list[float]]:
        response = self.openai.embeddings.create(
            model=self.settings.openai_embedding_model,
            input=texts,
        )
        return [item.embedding for item in response.data]


def iter_knowledge_files(knowledge_dir: Path) -> list[Path]:
    if not knowledge_dir.exists():
        return []
    return sorted(
        path
        for path in knowledge_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def split_text(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    normalized = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if not normalized:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + chunk_size, len(normalized))
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(normalized):
            break
        start = max(end - chunk_overlap, start + 1)

    return chunks


def make_chunk_id(file_path: Path, chunk_index: int, chunk: str) -> str:
    digest = hashlib.sha256(f"{file_path}:{chunk_index}:{chunk}".encode("utf-8")).hexdigest()
    return digest


def format_context(sources: list[Source]) -> str:
    if not sources:
        return "検索結果はありません。"

    parts = []
    for source in sources:
        parts.append(
            f"[file={source.file}, chunk={source.chunk}, distance={source.distance}]\n{source.content}"
        )
    return "\n\n---\n\n".join(parts)

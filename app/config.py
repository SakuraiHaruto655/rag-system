import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    openai_api_key: str
    openai_chat_model: str
    openai_embedding_model: str
    knowledge_dir: Path
    chroma_dir: Path
    chroma_collection: str


def get_settings() -> Settings:
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_chat_model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
        openai_embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        knowledge_dir=Path(os.getenv("KNOWLEDGE_DIR", "knowledge")),
        chroma_dir=Path(os.getenv("CHROMA_DIR", "chroma_db")),
        chroma_collection=os.getenv("CHROMA_COLLECTION", "local_knowledge"),
    )

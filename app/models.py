from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, description="ユーザーからの質問")
    top_k: int = Field(4, ge=1, le=10, description="Chromaから取得する関連チャンク数")


class Source(BaseModel):
    file: str
    chunk: int
    distance: float | None = None
    content: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]


class IngestRequest(BaseModel):
    knowledge_dir: str | None = Field(None, description="取り込み対象フォルダ。未指定なら環境変数KNOWLEDGE_DIR")
    chunk_size: int = Field(1000, ge=200, le=4000)
    chunk_overlap: int = Field(200, ge=0, le=1000)


class IngestResponse(BaseModel):
    files: int
    chunks: int
    collection: str

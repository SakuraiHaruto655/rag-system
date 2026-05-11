import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.config import get_settings
from app.rag import RagService


def main() -> None:
    parser = argparse.ArgumentParser(description="Markdown/text knowledge files into Chroma.")
    parser.add_argument("--knowledge-dir", default=None, help="Directory containing .md/.txt files")
    parser.add_argument("--chunk-size", type=int, default=1000)
    parser.add_argument("--chunk-overlap", type=int, default=200)
    args = parser.parse_args()

    if args.chunk_overlap >= args.chunk_size:
        raise SystemExit("chunk-overlap must be smaller than chunk-size")

    settings = get_settings()
    knowledge_dir = Path(args.knowledge_dir) if args.knowledge_dir else settings.knowledge_dir
    service = RagService(settings)
    files, chunks = service.ingest(knowledge_dir, args.chunk_size, args.chunk_overlap)
    print(f"Ingested {chunks} chunks from {files} files into '{settings.chroma_collection}'.")


if __name__ == "__main__":
    main()

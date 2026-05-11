# RAGシステム構築作業ログ

## 概要

このナレッジは、Local Knowledge RAGシステムを作成し、GitHub経由でEC2へ配置して起動するまでに行った作業をまとめたものです。同じ環境を再構築する際の手順確認や、運用時の参照情報として利用できます。

## 実施した作業

最初に、Windows上の `C:\Users\202404011\dev\rag_system` でRAGアプリを作成した。アプリはFastAPI、OpenAI API、Chromaを使い、`knowledge/` 配下のMarkdownやテキストを取り込んで質問応答できる構成にした。

次に、作成したプロジェクトをGitHubリポジトリ `SakuraiHaruto655/rag-system` にpushした。EC2側ではこのリポジトリをcloneし、以後の更新は `git pull` で反映できる構成にした。

その後、EC2上でGitHubリポジトリをcloneし、Python 3.11の仮想環境を作成した。`requirements.txt` から依存関係をインストールし、`.env.example` を `.env` にコピーしてOpenAI APIキーを設定した。

最後に、`python scripts/ingest.py` を実行してナレッジをChromaへ取り込み、`python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` でアプリを起動する流れを確認した。

## 構築時の設計ポイント

### GitHub経由でEC2へ配置

ローカルPCで開発したコードをGitHubへpushし、EC2側では `git clone` または `git pull` で反映する方式にした。これにより、ソースコードとナレッジファイルの更新履歴をGitで管理できる。

### Python 3.11を使用

アプリケーションはPython 3.11を前提にした。型ヒントや依存ライブラリの互換性を安定させるため、EC2上でも `python3.11 -m venv venv` で仮想環境を作成した。

### OpenAI APIキーは `.env` で管理

OpenAI APIキーは `.env` に設定し、Git管理から除外した。GitHubには `.env.example` のみを含め、必要な環境変数の形式だけを共有する。

### Chromaの永続化

ベクトルデータベースにはChromaを使用し、`CHROMA_DIR=chroma_db` に永続化する構成にした。EC2のルートEBS上に保存されるため、インスタンスを停止してもデータは維持される。

### 低コスト運用

チャットモデルは `gpt-4o-mini`、Embeddingモデルは `text-embedding-3-small` を利用する方針にした。ナレッジ更新時のみEmbedding APIを使い、通常の質問応答では必要な文脈だけを検索してChat APIへ渡す。

## 最終的に成功したコマンド

```bash
cd ~/rag-system
source venv/bin/activate
python scripts/ingest.py
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

ナレッジ取り込みが成功すると、以下のように表示される。

```text
Ingested 1 chunks from 1 files into 'local_knowledge'.
```

## RAGで質問できる例

- このRAGシステムはどのような手順で構築しましたか？
- このRAGシステムでGitHubを使う理由は何ですか？
- なぜPython 3.11を使用していますか？
- OpenAI APIキーはどのように管理していますか？
- Chromaのデータはどこに保存されますか？
- EC2でナレッジ取り込みを成功させるコマンドは何ですか？

## キーワード

RAG、FastAPI、OpenAI API、Chroma、EC2、GitHub、Personal Access Token、Python 3.11、ナレッジ取り込み、構築ログ

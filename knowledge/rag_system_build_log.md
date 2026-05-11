# RAGシステム構築作業ログ

## 概要

このナレッジは、Local Knowledge RAGシステムを作成し、GitHub経由でEC2へ配置して起動するまでに行った作業をまとめたものです。構築中に発生したエラーと対応も含めているため、同じ環境を再構築する際の手順確認に利用できます。

## 実施した作業

最初に、Windows上の `C:\Users\202404011\dev\rag_system` でRAGアプリを作成した。アプリはFastAPI、OpenAI API、Chromaを使い、`knowledge/` 配下のMarkdownやテキストを取り込んで質問応答できる構成にした。

次に、作成したプロジェクトをGitHubリポジトリ `SakuraiHaruto655/rag-system` にpushした。GitHubはパスワード認証をサポートしていないため、Personal Access Tokenを発行し、Windowsの古いGitHub資格情報を削除してから再認証した。

その後、EC2上でGitHubリポジトリをcloneし、Python 3.11の仮想環境を作成した。`requirements.txt` から依存関係をインストールし、`.env.example` を `.env` にコピーしてOpenAI APIキーを設定した。

最後に、`python scripts/ingest.py` を実行してナレッジをChromaへ取り込み、`python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` でアプリを起動する流れを確認した。

## 発生した問題と対応

### `.env.example` が見つからなかった

EC2にプロジェクト本体をまだ取り込んでいない状態で `cp .env.example .env` を実行したため、`.env.example` が存在しないというエラーが出た。対応として、ローカルPCのプロジェクトをGitHubへpushし、EC2側でcloneする方針に変更した。

### GitHubへのpushで認証エラーが出た

`Invalid username or token` や `Permission denied` が発生した。原因は、GitHubのパスワード認証が使えないことと、push先リポジトリの所有者とログイン中ユーザーが一致していなかったことだった。Personal Access Tokenを発行し、Windowsの資格情報マネージャーから古い認証情報を削除して再ログインしたことで解決した。

### `ModuleNotFoundError: No module named 'app'`

EC2に `app/` フォルダを含むプロジェクト本体が配置されていない、またはプロジェクト直下以外で起動していたことが原因だった。GitHubからcloneし、`cd ~/rag-system` してから起動することで解決した。

### Python 3.9による型ヒントエラー

EC2の仮想環境がPython 3.9で作られていたため、`float | None` の型ヒントで `TypeError` が発生した。Python 3.11をインストールし、`python3.11 -m venv venv` で仮想環境を作り直した。

### OpenAI APIのクォータ不足

ナレッジ取り込み時に `insufficient_quota` が発生した。これはアプリの問題ではなく、OpenAI Platform側の課金設定または利用枠の不足が原因だった。Billing設定を確認し、API利用可能な状態にしたあと、再度 `python scripts/ingest.py` を実行して成功した。

### `python: command not found`

EC2でホームディレクトリにいる状態、かつ仮想環境が有効でない状態で `python scripts/ingest.py` を実行したため発生した。`cd ~/rag-system` と `source venv/bin/activate` を実行してから再試行した。

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
- GitHubへのpushで認証エラーが出た理由は何ですか？
- EC2で `ModuleNotFoundError` が出たときの対応は何ですか？
- Python 3.9ではなぜエラーになりましたか？
- OpenAI APIの `insufficient_quota` は何が原因ですか？
- EC2でナレッジ取り込みを成功させるコマンドは何ですか？

## キーワード

RAG、FastAPI、OpenAI API、Chroma、EC2、GitHub、Personal Access Token、Python 3.11、ナレッジ取り込み、構築ログ

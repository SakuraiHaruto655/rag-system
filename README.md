# Local Knowledge RAG

Amazon Linux 2023 / Python 3.11 / FastAPI / OpenAI API / Chromaで動作する、ローカルナレッジ向けRAGアプリです。

## 構成

- `app/main.py`: FastAPIエントリポイント
- `app/rag.py`: ナレッジ取り込み、Embedding生成、Chroma検索、回答生成
- `app/static/`: HTML / CSS / JavaScriptのチャット画面
- `knowledge/`: Markdown / テキストのナレッジ格納先
- `chroma_db/`: Chroma永続化先。EC2のEBS上に保存されます
- `scripts/ingest.py`: CLI取り込みスクリプト

## EC2セットアップ

Amazon Linux 2023で以下を実行します。ここまで完了している場合は、次の「アプリ配置」から進めてください。

```bash
sudo dnf update -y
sudo dnf install -y git python3 python3-pip
python3 --version
pip3 --version
```

プロジェクト用ディレクトリと仮想環境を作成します。

```bash
mkdir ~/rag-system
cd ~/rag-system
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn openai chromadb python-multipart jinja2 python-dotenv
pip freeze > requirements.txt
```

## アプリ配置

このリポジトリ内のファイル一式をEC2の `~/rag-system` に配置します。配置後、以下のような構成になっていればOKです。

```text
~/rag-system/
├── app/
├── knowledge/
├── scripts/
├── .env.example
├── requirements.txt
└── README.md
```

環境変数を設定します。

```bash
cp .env.example .env
vi .env
```

`.env` の `OPENAI_API_KEY` にOpenAI APIキーを設定してください。

## ナレッジ取り込み

`knowledge` フォルダに `.md`、`.markdown`、`.txt` ファイルを配置します。

CLIで取り込む場合:

```bash
source venv/bin/activate
python scripts/ingest.py
```

Web画面から取り込む場合は、アプリ起動後に「ナレッジ取り込み」ボタンを押してください。

## 起動

開発・検証用:

```bash
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

ブラウザで以下にアクセスします。

```text
http://<EC2のパブリックIP>:8000/
```

EC2のセキュリティグループでTCP `8000` を許可してください。本番運用ではNginxやsystemdでの常駐化を検討してください。

## API

### ヘルスチェック

```bash
curl http://localhost:8000/api/health
```

### ナレッジ取り込み

```bash
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 質問応答

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"サンプルナレッジには何が書かれていますか？","top_k":4}'
```

## 秘密情報

OpenAI APIキーは `.env` またはEC2の環境変数で設定します。`.env` は `.gitignore` に含めており、Git管理しない前提です。
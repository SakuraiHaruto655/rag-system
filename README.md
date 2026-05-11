# Local Knowledge RAG

Amazon Linux 2023 / Python 3.11 / FastAPI / OpenAI API / Chromaで動作する、ローカルナレッジ向けRAGアプリです。

## 構成

- `app/main.py`: FastAPIエントリポイント
- `app/rag.py`: ナレッジ取り込み、Embedding生成、Chroma検索、回答生成
- `app/static/`: HTML / CSS / JavaScriptのチャット画面
- `knowledge/`: Markdown / テキストのナレッジ格納先
- `chroma_db/`: Chroma永続化先。EC2のEBS上に保存されます
- `scripts/ingest.py`: CLI取り込みスクリプト

## セットアップ全体の流れ

今回の構築では、ローカルPCで作成したプロジェクトをGitHubへpushし、EC2上でcloneして起動する手順を採用しています。

大まかな流れは以下です。

1. ローカルPCでプロジェクトを作成する
2. GitHubリポジトリへpushする
3. EC2でGitHubリポジトリをcloneする
4. Python 3.11の仮想環境を作成する
5. `.env` にOpenAI APIキーを設定する
6. ナレッジを取り込む
7. FastAPIアプリを起動する

## ローカルPCからGitHubへpush

Windows側で初回pushする場合の例です。

```powershell
cd C:\Users\202404011\dev\rag_system
git init
git add .
git commit -m "Initial RAG app"
git branch -M main
git remote add origin https://github.com/SakuraiHaruto655/rag-system.git
git push -u origin main
```

GitHubはパスワード認証に対応していないため、HTTPSでpushする場合はPersonal Access Tokenを使用します。`Permission denied` や `Invalid username or token` が出る場合は、Windowsの資格情報マネージャーから古いGitHub認証情報を削除し、正しいGitHubユーザーとtokenで再認証してください。

`.env` は秘密情報を含むためGit管理しません。GitHubへpushするのは `.env.example` だけです。

## EC2セットアップ

Amazon Linux 2023で以下を実行します。

```bash
sudo dnf update -y
sudo dnf install -y git python3.11 python3.11-pip
python3.11 --version
```

## アプリ配置

EC2側でGitHubからプロジェクトを取得します。

```bash
cd ~
git clone https://github.com/SakuraiHaruto655/rag-system.git rag-system
cd ~/rag-system
```

すでに `~/rag-system` が存在する場合は、退避してからcloneします。

```bash
cd ~
mv rag-system rag-system-old
git clone https://github.com/SakuraiHaruto655/rag-system.git rag-system
cd ~/rag-system
```

配置後、以下のような構成になっていればOKです。

```text
~/rag-system/
├── app/
├── knowledge/
├── scripts/
├── .env.example
├── requirements.txt
└── README.md
```

## Python仮想環境

このアプリはPython 3.11を前提にしています。Python 3.9で作成した仮想環境では、`float | None` の型ヒントが原因でエラーになることがあります。

```bash
cd ~/rag-system
python3.11 -m venv venv
source venv/bin/activate
python --version
pip install --upgrade pip
pip install -r requirements.txt
```

`python --version` が `Python 3.11.x` になっていることを確認してください。

## 環境変数

環境変数を設定します。

```bash
cp .env.example .env
vi .env
```

`.env` の `OPENAI_API_KEY` にOpenAI APIキーを設定してください。

```env
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
KNOWLEDGE_DIR=knowledge
CHROMA_DIR=chroma_db
CHROMA_COLLECTION=local_knowledge
```

OpenAI APIで `insufficient_quota` が出る場合は、APIキーは読み込めていますが、OpenAI Platform側の課金設定または利用枠が不足しています。Billingで支払い方法やクレジットを確認してください。

## ナレッジ取り込み

`knowledge` フォルダに `.md`、`.markdown`、`.txt` ファイルを配置します。

CLIで取り込む場合:

```bash
source venv/bin/activate
python scripts/ingest.py
```

成功すると以下のように表示されます。

```text
Ingested 1 chunks from 1 files into 'local_knowledge'.
```

Web画面から取り込む場合は、アプリ起動後に「ナレッジ取り込み」ボタンを押してください。

## 起動

開発・検証用:

```bash
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

ブラウザで以下にアクセスします。

```text
http://<EC2のパブリックIP>:8000/
```

EC2のセキュリティグループでTCP `8000` を許可してください。本番運用ではNginxやsystemdでの常駐化を検討してください。

## 更新手順

ローカルPCでナレッジやコードを更新した場合は、commitしてGitHubへpushします。

```powershell
git add .
git commit -m "Update knowledge"
git push
```

EC2側ではpullして再取り込みします。

```bash
cd ~/rag-system
git pull
source venv/bin/activate
python scripts/ingest.py
```

## 今回発生した主なエラーと対応

### `.env.example` が見つからない

EC2にプロジェクト本体を配置していない状態で `cp .env.example .env` を実行すると発生します。GitHubへpush後、EC2で `git clone` してから再実行してください。

### `ModuleNotFoundError: No module named 'app'`

プロジェクト直下ではない場所で起動している、またはEC2に `app/` フォルダが配置されていない場合に発生します。`cd ~/rag-system` してから `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` を実行してください。

### `TypeError: unsupported operand type(s) for |`

Python 3.9で実行している場合に発生します。Python 3.11で仮想環境を作り直してください。

### `openai.RateLimitError: insufficient_quota`

OpenAI APIの課金設定または利用枠が不足しています。OpenAI PlatformのBillingで支払い方法やクレジットを設定してください。

### `python: command not found`

仮想環境が有効でない、またはプロジェクトディレクトリ外で実行している可能性があります。`cd ~/rag-system` と `source venv/bin/activate` を実行してから再試行してください。

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
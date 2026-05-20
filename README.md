# Local Knowledge RAG

Amazon Linux 2023 / Python 3.11 / FastAPI / OpenAI API / Chromaで動作する、ローカルナレッジ向けRAGアプリです。

## 構成

- `app/main.py`: FastAPIエントリポイント
- `app/rag.py`: ナレッジ取り込み、Embedding生成、Chroma検索、回答生成
- `app/static/`: HTML / CSS / JavaScriptのチャット画面
- `knowledge/`: Markdown / テキストのナレッジ格納先
- `chroma_db/`: Chroma永続化先。EC2のEBS上に保存されます
- `scripts/ingest.py`: CLI取り込みスクリプト
- `deploy/`: EC2公開用のsystemdユニットとNginx設定

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

この起動方法はSSHセッションを閉じるとプロセスが止まります。常時公開する場合は次の「EC2でオンライン公開（systemd + Nginx）」の手順を実施してください。

## EC2でオンライン公開（systemd + Nginx）

`uvicorn` を `127.0.0.1:8000` でsystemd常駐化し、Nginxを80番ポートのリバースプロキシとして前段に置きます。これによりSSHを切ってもアプリが動き続け、`http://<EC2のパブリックIP>/` でアクセスできるようになります。

設定ファイルは `deploy/` 配下に含めています。

- `deploy/rag-system.service`: systemdユニット
- `deploy/nginx-rag.conf`: Nginxサイト設定

### 1. セキュリティグループの設定

EC2のセキュリティグループで以下を設定します。

- TCP `80` をインバウンド許可（社内利用ならソースを社内IPに絞ることを推奨）
- TCP `8000` は閉じたままでOK（systemdユニットは `127.0.0.1` でのみLISTENするため、外部からは到達不要）

### 2. uvicornをsystemdで常駐化

`deploy/rag-system.service` は `User=ec2-user`、`WorkingDirectory=/home/ec2-user/rag-system` を前提としています。別ユーザー・別パスを使う場合は編集してください。

```bash
sudo cp deploy/rag-system.service /etc/systemd/system/rag-system.service
sudo systemctl daemon-reload
sudo systemctl enable --now rag-system
sudo systemctl status rag-system
```

ログを確認する場合:

```bash
sudo journalctl -u rag-system -f
```

起動後、ローカルで疎通確認します。

```bash
curl http://127.0.0.1:8000/api/health
```

### 3. Nginxのインストールと設定

```bash
sudo dnf install -y nginx
```

Amazon Linux 2023の `/etc/nginx/nginx.conf` には既定で80番ポートを `default_server` として待ち受ける `server { ... }` ブロックが含まれています。今回のNginx設定も `default_server` を使うため、競合させないように既定の `server` ブロックをコメントアウト（または削除）してください。

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
sudo vi /etc/nginx/nginx.conf
```

`http { ... }` の中にある `server { listen 80 default_server; ... }` ブロックを丸ごとコメントアウトします。

次に本アプリ用の設定ファイルを配置します。

```bash
sudo cp deploy/nginx-rag.conf /etc/nginx/conf.d/rag-system.conf
sudo nginx -t
sudo systemctl enable --now nginx
```

`nginx -t` で `syntax is ok` / `test is successful` が表示されればOKです。

### 4. 動作確認

ブラウザで以下にアクセスします。

```text
http://<EC2のパブリックIP>/
```

チャット画面が表示され、質問送信とナレッジ取り込みが動けば公開成功です。

### 5. 更新時の再起動

コードを更新したあとは、systemd経由でアプリを再起動します。

```bash
cd ~/rag-system
git pull
source venv/bin/activate
pip install -r requirements.txt   # 依存に変更がある場合のみ
python scripts/ingest.py          # ナレッジを更新した場合のみ
sudo systemctl restart rag-system
```

Nginx設定を更新した場合は以下を実行します。

```bash
sudo cp deploy/nginx-rag.conf /etc/nginx/conf.d/rag-system.conf
sudo nginx -t
sudo systemctl reload nginx
```

### トラブルシュート

- ブラウザで `502 Bad Gateway` が出る: `sudo systemctl status rag-system` でアプリの状態を確認します。`.env` のパスや `OPENAI_API_KEY` 未設定が原因の場合があります。
- ブラウザで `403 Forbidden` や既定のNginxページが出る: `/etc/nginx/nginx.conf` の既定 `server` ブロックを無効化できていません。コメントアウトしたうえで `sudo systemctl reload nginx` を実行してください。
- 外部からアクセスできない: セキュリティグループでTCP `80` のインバウンドが許可されているか、EC2に**パブリックIP**が割り当たっているかを確認してください。

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
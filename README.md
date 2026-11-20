# 在庫プーリング最適化 Web アプリ

`lecture2026/MIT-SCD/08Inventory_Pooling_Exercise.py` の最適化モデルを、React + FastAPI の Web アプリにしたもの。
倉庫の開設と顧客の割当を決め、固定費・発注保管費・安全在庫費・輸送費の合計を最小化する（AMPL + Gurobi）。

## 機能

- 在庫パラメータ（単位購入費・保管費率・発注費・サービス水準・輸送単価）の変更
- リードタイムの「全倉庫共通」と「倉庫別」（課題 2a/2b の値が初期値）の切替
- 地図（react-leaflet）: 開設倉庫・閉鎖倉庫・顧客の割当を倉庫ごとの色で表示
- 費用内訳、倉庫別の集計表（容量使用率・安全在庫・EOQ）
- シナリオの保存・比較・削除（データベースに保存。ローカルは SQLite、本番は PostgreSQL）
- ソルバーログの表示

## 構成

```
inventory_pooling_app/
├── backend/            FastAPI + amplpy
│   ├── main.py         API（/api/network, /api/solve, /api/scenarios）
│   ├── optimizer.py    AMPL モデルと求解・集計
│   ├── data/           顧客・倉庫 CSV（GitHub の scm275 から取得して同梱）
│   └── storage.py      シナリオの保存（DATABASE_URL があれば PostgreSQL、無ければ scenarios.db）
└── frontend/           React + TypeScript（Vite）
    └── src/
        ├── App.tsx
        └── components/ ParamPanel / NetworkMap / ResultView / ScenarioView
```

## 準備（初回のみ）

```bash
# バックエンド
pip install -r backend/requirements.txt
python -m amplpy.modules install gurobi   # AMPL 用 Gurobi（AMPL のライセンスが必要）

# フロントエンド
cd frontend
npm install
```

## 起動

ターミナルを 2 つ使う。

```bash
# 1. バックエンド（ポート 8000）
cd backend
python -m uvicorn main:app --reload --port 8000

# 2. フロントエンド（ポート 5173）
cd frontend
npm.cmd run dev

```

ブラウザで http://localhost:5173 を開く。

### Windows の PowerShell で起動できないとき

- **`npm` が「スクリプトの実行が無効」で止まる:** `npm.cmd run dev` と打つか、`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` を一度実行する。
- **uvicorn が `[WinError 10013]` で止まる:** ポート 8000 を別のプロセス（前回起動したまま残った uvicorn など）が使っている。`Get-NetTCPConnection -LocalPort 8000 -State Listen` でプロセス番号を調べて `Stop-Process -Id <番号>` で止める。

ブラウザの `/api` へのリクエストは Vite がバックエンドに転送する。

## デプロイ（Docker）

`Dockerfile` でフロントエンドをビルドし、FastAPI が画面と API を同じポートで配信する（1 コンテナ）。

```bash
docker build -t inventory-pooling .
docker run -p 8000:8000 inventory-pooling   # http://localhost:8000
```

- **ライセンス:** 環境変数 `AMPL_LICENSE_UUID` を設定すると起動時に有効化する。未設定ならデモライセンス（500 変数・500 制約まで）で動き、このモデル（倉庫 5 × 顧客 35）はその範囲に収まる。
- **ポート:** 環境変数 `PORT` で変えられる（Render などはこれを自動で設定する）。
- **シナリオの保存:** 環境変数 `DATABASE_URL` に PostgreSQL の接続文字列（`postgresql://...` または `postgres://...`）を設定すると、そこに保存する。テーブルは初回起動時に自動で作る。未設定だとコンテナ内の SQLite ファイルに書くので、再起動や再デプロイで消える。

### PostgreSQL の用意（Neon の場合）

1. https://neon.tech でアカウントを作り、プロジェクトを作成する（無料プラン）。
2. ダッシュボードの Connect に出る接続文字列（`postgresql://ユーザー:パスワード@ホスト/DB名?sslmode=require`）をコピーする。
3. Render の Environment に `DATABASE_URL` として貼り付ける。

接続文字列にはパスワードが含まれるので、GitHub やコードには書かない。Supabase でも同様（Project Settings → Database → Connection string）。

### Render の場合

1. このフォルダを含むリポジトリを GitHub に push する。
2. Render で New → Web Service → リポジトリを選ぶ。
3. Language: Docker、Root Directory: `inventory_pooling_app`（リポジトリ直下に置いた場合は空欄）。
4. Instance Type: Free で作成。数分でビルドされ `https://<名前>.onrender.com` で開ける。

無料プランは 15 分アクセスが無いと止まり、次のアクセスで起動するまで 1 分ほどかかる。

## モデル

元のスクリプトとの違いは、リードタイムを倉庫別のパラメータ `lead_time[w]` にした点だけ。
安全在庫費は `z · h · c · Σ_w √L_w · v_w` になる。全倉庫共通モードでは全倉庫に同じ値を入れるので、元のモデルと同じ結果（初期値で総費用 $1,075,830）になる。

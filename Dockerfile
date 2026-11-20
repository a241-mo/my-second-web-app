# 在庫プーリング最適化アプリ（フロントエンド + API を 1 コンテナで配信）

# --- 1. フロントエンドのビルド ---
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- 2. API サーバー ---
FROM python:3.12-slim
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && python -m amplpy.modules install gurobi

COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist

ENV FRONTEND_DIST=/app/frontend/dist \
    PORT=8000
EXPOSE 8000

# AMPL_LICENSE_UUID が設定されていれば起動時にライセンスを有効化する
# （未設定ならデモライセンス: 500 変数・500 制約まで。このモデルはその範囲に収まる）
CMD ["sh", "-c", "if [ -n \"$AMPL_LICENSE_UUID\" ]; then python -m amplpy.modules activate \"$AMPL_LICENSE_UUID\"; fi; exec uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

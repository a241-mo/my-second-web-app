"""シナリオの保存先（データベース）。

環境変数 DATABASE_URL があればそのデータベース（PostgreSQL など）に、
無ければ backend/scenarios.db（SQLite）に保存する。
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from sqlalchemy import Column, MetaData, String, Table, Text, create_engine, delete, insert, select


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        return f"sqlite:///{Path(__file__).parent / 'scenarios.db'}"
    # Neon・Supabase・Render などは postgres:// / postgresql:// 形式で渡すので、psycopg 3 を使う形に直す
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


_url = _database_url()
# PostgreSQL に届かないとき、起動が固まらず 10 秒でエラーにする
engine = create_engine(_url, pool_pre_ping=True,
                       connect_args={"connect_timeout": 10} if _url.startswith("postgresql") else {})
metadata = MetaData()

# 入力パラメータと結果は JSON 文字列のまま 1 列ずつ持つ
scenarios = Table(
    "scenarios",
    metadata,
    Column("id", String(32), primary_key=True),
    Column("name", String(100), nullable=False),
    Column("created_at", String(32), nullable=False),  # ISO 8601（文字列の順序 = 時刻の順序）
    Column("params", Text, nullable=False),
    Column("result", Text, nullable=False),
)
metadata.create_all(engine)  # テーブルが無ければ作る


def _to_dict(row) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "created_at": row.created_at,
        "params": json.loads(row.params),
        "result": json.loads(row.result),
    }


def list_all() -> list[dict]:
    """全シナリオ（新しい順）。"""
    with engine.connect() as conn:
        rows = conn.execute(select(scenarios).order_by(scenarios.c.created_at.desc()))
        return [_to_dict(r) for r in rows]


def get(scenario_id: str) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(select(scenarios).where(scenarios.c.id == scenario_id)).first()
        return _to_dict(row) if row else None


def add(data: dict) -> None:
    with engine.begin() as conn:
        conn.execute(insert(scenarios).values(
            id=data["id"],
            name=data["name"],
            created_at=data["created_at"],
            params=json.dumps(data["params"], ensure_ascii=False),
            result=json.dumps(data["result"], ensure_ascii=False),
        ))


def remove(scenario_id: str) -> bool:
    """削除できたら True（該当なしなら False）。"""
    with engine.begin() as conn:
        return conn.execute(delete(scenarios).where(scenarios.c.id == scenario_id)).rowcount > 0

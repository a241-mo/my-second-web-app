"""在庫プーリング最適化 Web アプリの API（FastAPI）。

起動: uvicorn main:app --reload --port 8000   （backend フォルダで実行）
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import optimizer
import storage

app = FastAPI(title="Inventory Pooling API")


class SolveParams(BaseModel):
    """画面から変更できる入力パラメータ。"""

    unit_purchase_cost: float = Field(gt=0)
    annual_carrying_charge: float = Field(gt=0, le=1)
    ordering_cost: float = Field(gt=0)
    service_level: float = Field(gt=0, lt=1)
    cost_per_unit_km: float = Field(ge=0)
    lead_time_mode: Literal["common", "per_warehouse"]
    common_lead_time_days: float = Field(gt=0)
    lead_times_days: dict[str, float]


class ScenarioIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    params: SolveParams
    result: dict


@app.get("/api/network")
def get_network():
    """顧客・倉庫データと既定パラメータ。"""
    return optimizer.network_data()


@app.post("/api/solve")
def solve(params: SolveParams):
    """パラメータでモデルを解いて結果を返す。"""
    # 使うリードタイムだけを検証する（共通モードでは倉庫別の値は使わない）
    if params.lead_time_mode == "per_warehouse":
        wh_ids = list(optimizer.WAREHOUSES["ID"])
        missing = [w for w in wh_ids if w not in params.lead_times_days]
        if missing:
            raise HTTPException(422, f"リードタイムが未入力の倉庫があります: {missing}")
        if any(params.lead_times_days[w] <= 0 for w in wh_ids):
            raise HTTPException(422, "リードタイムは正の値にしてください")
    return optimizer.solve(params.model_dump())


NOT_FOUND = "シナリオが見つかりません"


@app.get("/api/scenarios")
def list_scenarios():
    """保存済みシナリオの一覧（新しい順、ログは省略）。"""
    items = []
    for s in storage.list_all():
        result = {k: v for k, v in s["result"].items() if k not in ("log", "assignments")}
        items.append({**s, "result": result})
    return items


@app.post("/api/scenarios", status_code=201)
def create_scenario(scenario: ScenarioIn):
    """入力・結果・ログをまとめてデータベースの 1 行に保存する。"""
    data = {
        "id": uuid.uuid4().hex,
        "name": scenario.name,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "params": scenario.params.model_dump(),
        "result": scenario.result,
    }
    storage.add(data)
    return data


@app.get("/api/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    s = storage.get(scenario_id)
    if s is None:
        raise HTTPException(404, NOT_FOUND)
    return s


@app.delete("/api/scenarios/{scenario_id}", status_code=204)
def delete_scenario(scenario_id: str):
    if not storage.remove(scenario_id):
        raise HTTPException(404, NOT_FOUND)


# 本番（Docker）ではビルド済みのフロントエンドを同じサーバーから配信する。
# 開発時（dist が無いとき）は Vite の開発サーバーを使うので何もしない。
FRONTEND_DIST = Path(os.environ.get("FRONTEND_DIST", Path(__file__).parent.parent / "frontend" / "dist"))
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

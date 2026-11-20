"""在庫プーリング最適化（AMPL + Gurobi）。

MIT-SCD/08Inventory_Pooling_Exercise.py のモデルを Web API 用に整理したもの。
リードタイムを倉庫別のパラメータ lead_time[w] にしている（課題 2a/2b）。
全倉庫共通モードでは全倉庫に同じ値を入れるので、元のモデルと一致する。
"""

from __future__ import annotations

import math
import time
from pathlib import Path

import pandas as pd
import scipy.stats as st
from amplpy import AMPL
from geopy.distance import geodesic

DATA_DIR = Path(__file__).parent / "data"

# 在庫プーリングの最適化モデル（AMPL 記述）
AMPL_MODEL = r"""
set W;                                 # 倉庫の集合
set C;                                 # 顧客の集合

param fixed_cost {W};                  # 倉庫の固定費
param capacity {W};                    # 倉庫の容量
param lead_time {W};                   # 倉庫ごとのリードタイム（年）
param demand {C};                      # 顧客の年間需要
param sigma {C};                       # 顧客需要の標準偏差
param unit_cost {W, C};                # 倉庫から顧客への単位輸送費
param ss_factor;                       # 安全在庫係数
param carrying_charge;                 # 年間在庫保管費率
param purchase_cost;                   # 単位購入費
param ordering_cost;                   # 1 回あたりの発注費

var open {W} binary;                   # 倉庫の開設
var assign {W, C} binary;              # 顧客の倉庫への割当
var u {W} >= 0;                        # 割り当てられた需要の平方根
var v {W} >= 0;                        # 割り当てられた需要の標準偏差

minimize Total_Cost:
      sum {w in W} fixed_cost[w] * open[w]
    + sqrt(2 * carrying_charge * purchase_cost * ordering_cost) * sum {w in W} u[w]
    + ss_factor * carrying_charge * purchase_cost * sum {w in W} sqrt(lead_time[w]) * v[w]
    + sum {w in W, c in C} unit_cost[w, c] * assign[w, c] * demand[c];

subject to Assign_Once {c in C}:
    sum {w in W} assign[w, c] = 1;

subject to Capacity {w in W}:
    sum {c in C} assign[w, c] * demand[c] <= open[w] * capacity[w];

subject to Def_U {w in W}:
    u[w]^2 = sum {c in C} assign[w, c] * demand[c];

subject to Def_V {w in W}:
    v[w]^2 = sum {c in C} assign[w, c] * sigma[c]^2;
"""

# ノートブックの初期値と課題 2a の倉庫別リードタイム
DEFAULT_PARAMS = {
    "unit_purchase_cost": 10.0,
    "annual_carrying_charge": 0.2,
    "ordering_cost": 10000.0,
    "service_level": 0.95,
    "cost_per_unit_km": 0.0005,
    "lead_time_mode": "common",
    "common_lead_time_days": 60.0,
    "lead_times_days": {"w1": 40.0, "w2": 67.0, "w3": 55.0, "w4": 32.0, "w5": 50.0},
}


def load_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    """同梱の顧客・倉庫 CSV を読み込む（名前の前後の空白は除く）。"""
    customers = pd.read_csv(DATA_DIR / "customers.csv")
    warehouses = pd.read_csv(DATA_DIR / "warehouses.csv")
    for df in (customers, warehouses):
        df["name"] = df["name"].str.strip()
    return customers, warehouses


CUSTOMERS, WAREHOUSES = load_data()

# 倉庫と顧客の間の距離（km）は入力によらないので起動時に 1 回だけ計算する
DISTANCES = {
    (w.ID, c.ID): geodesic((w.lat, w.lon), (c.lat, c.lon)).km
    for w in WAREHOUSES.itertuples()
    for c in CUSTOMERS.itertuples()
}


def network_data() -> dict:
    """画面の初期表示用に、顧客・倉庫・既定パラメータを返す。"""
    return {
        "customers": CUSTOMERS.to_dict(orient="records"),
        "warehouses": WAREHOUSES.to_dict(orient="records"),
        "default_params": DEFAULT_PARAMS,
    }


def solve(params: dict) -> dict:
    """パラメータを受け取ってモデルを解き、画面表示用の結果を返す。"""
    wh_ids = list(WAREHOUSES["ID"])
    cu_ids = list(CUSTOMERS["ID"])
    demand = dict(zip(CUSTOMERS["ID"], CUSTOMERS["demand"].astype(float)))
    sigma = dict(zip(CUSTOMERS["ID"], CUSTOMERS["sigma"].astype(float)))
    fixed_cost = dict(zip(WAREHOUSES["ID"], WAREHOUSES["fixed_cost"].astype(float)))
    capacity = dict(zip(WAREHOUSES["ID"], WAREHOUSES["capacity"].astype(float)))

    if params["lead_time_mode"] == "common":
        lead_days = {w: params["common_lead_time_days"] for w in wh_ids}
    else:
        lead_days = {w: params["lead_times_days"][w] for w in wh_ids}
    lead_years = {w: d / 365 for w, d in lead_days.items()}

    unit_cost = {k: d * params["cost_per_unit_km"] for k, d in DISTANCES.items()}
    ss_factor = float(st.norm.ppf(params["service_level"]))
    h = params["annual_carrying_charge"]
    c = params["unit_purchase_cost"]
    k = params["ordering_cost"]

    ampl = AMPL()
    try:
        return _solve_with(ampl, wh_ids, cu_ids, demand, sigma, fixed_cost, capacity,
                           lead_days, lead_years, unit_cost, ss_factor, h, c, k)
    finally:
        ampl.close()  # 成功・失敗にかかわらず AMPL のプロセスを閉じる


def _solve_with(ampl, wh_ids, cu_ids, demand, sigma, fixed_cost, capacity,
                lead_days, lead_years, unit_cost, ss_factor, h, c, k) -> dict:
    ampl.eval(AMPL_MODEL)
    ampl.set["W"] = wh_ids
    ampl.set["C"] = cu_ids
    ampl.param["fixed_cost"] = fixed_cost
    ampl.param["capacity"] = capacity
    ampl.param["lead_time"] = lead_years
    ampl.param["demand"] = demand
    ampl.param["sigma"] = sigma
    ampl.param["unit_cost"] = unit_cost
    ampl.param["ss_factor"] = ss_factor
    ampl.param["carrying_charge"] = h
    ampl.param["purchase_cost"] = c
    ampl.param["ordering_cost"] = k
    ampl.option["solver"] = "gurobi"
    ampl.option["gurobi_options"] = "outlev=1 timelim=60"

    start = time.perf_counter()
    log = ampl.get_output("solve;")
    elapsed = time.perf_counter() - start

    status = ampl.solve_result
    if status not in ("solved", "limit"):
        return {"status": status, "message": ampl.solve_message, "log": log}

    open_ = ampl.var["open"].get_values().to_dict()
    assign = ampl.var["assign"].get_values().to_dict()

    assignments = [{"warehouse": w, "customer": cu} for (w, cu), x in assign.items() if x > 0.5]

    # 倉庫別の集計と費用内訳（解から Python 側で計算）
    eoq_coef = math.sqrt(2 * h * c * k)
    rows = []
    totals = {"fixed": 0.0, "ordering_holding": 0.0, "safety_stock": 0.0, "transportation": 0.0}
    for w in WAREHOUSES.itertuples():
        mine = [a["customer"] for a in assignments if a["warehouse"] == w.ID]
        d = sum(demand[x] for x in mine)
        sd = math.sqrt(sum(sigma[x] ** 2 for x in mine))
        is_open = open_[w.ID] > 0.5
        safety_stock_units = ss_factor * math.sqrt(lead_years[w.ID]) * sd
        cost = {
            "fixed": w.fixed_cost if is_open else 0.0,
            "ordering_holding": eoq_coef * math.sqrt(d),
            "safety_stock": h * c * safety_stock_units,
            "transportation": sum(unit_cost[w.ID, x] * demand[x] for x in mine),
        }
        for key in totals:
            totals[key] += cost[key]
        rows.append({
            "id": w.ID,
            "name": w.name,
            "open": is_open,
            "num_customers": len(mine),
            "demand": d,
            "capacity": w.capacity,
            "utilization": d / w.capacity,
            "lead_time_days": lead_days[w.ID],
            "demand_sd": sd,
            "safety_stock_units": safety_stock_units,
            "eoq": math.sqrt(2 * k * d / (h * c)) if d > 0 else 0.0,
            "costs": cost,
        })

    return {
        "status": status,
        "message": ampl_message(status),
        "total_cost": sum(totals.values()),
        "cost_breakdown": totals,
        "safety_stock_factor": ss_factor,
        "warehouses": rows,
        "assignments": assignments,
        "solve_seconds": elapsed,
        "log": log,
    }


def ampl_message(status: str) -> str:
    return {"solved": "最適解が得られました", "limit": "時間制限に達しました（暫定解）"}.get(status, status)

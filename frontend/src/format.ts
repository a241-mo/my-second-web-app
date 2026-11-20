import type { CostKey } from "./types";

export const COST_LABELS: Record<CostKey, string> = {
  fixed: "固定費",
  ordering_holding: "発注・保管費",
  safety_stock: "安全在庫費",
  transportation: "輸送費",
};

export const COST_KEYS: CostKey[] = ["fixed", "ordering_holding", "safety_stock", "transportation"];

export const COST_COLORS: Record<CostKey, string> = {
  fixed: "#5b6b8c",
  ordering_holding: "#d99a2b",
  safety_stock: "#2f9a72",
  transportation: "#4c7fd1",
};

// 開設された倉庫ごとの色（地図で割当を区別するため）
export const WAREHOUSE_COLORS: Record<string, string> = {
  w1: "#c2410c",
  w2: "#2563eb",
  w3: "#9333ea",
  w4: "#0f766e",
  w5: "#be185d",
};

const num = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });

export const usd =(v: number) => `$${num.format(v)}`;
export const int = (v: number) => num.format(v);
export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

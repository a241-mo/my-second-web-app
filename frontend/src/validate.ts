import type { Params, Warehouse } from "./types";

export const PARAM_LABELS: Record<string, string> = {
  unit_purchase_cost: "単位購入費",
  annual_carrying_charge: "年間保管費率",
  ordering_cost: "発注費",
  service_level: "サービス水準",
  cost_per_unit_km: "輸送単価",
  common_lead_time_days: "リードタイム",
  lead_times_days: "倉庫別リードタイム",
  lead_time_mode: "リードタイムの種類",
  name: "シナリオ名",
};

/** 入力を送信前に確かめ、問題があれば日本語のメッセージを返す */
export function validateParams(p: Params, warehouses: Warehouse[]): string[] {
  const errs: string[] = [];
  const check = (key: keyof Params, ok: (v: number) => boolean, rule: string) => {
    const v = p[key] as number;
    if (!Number.isFinite(v)) errs.push(`${PARAM_LABELS[key]}を入力してください`);
    else if (!ok(v)) errs.push(`${PARAM_LABELS[key]}は${rule}`);
  };
  check("unit_purchase_cost", (v) => v > 0, "0 より大きい値にしてください");
  check("annual_carrying_charge", (v) => v > 0 && v <= 1, "0 より大きく 1 以下にしてください（例: 0.2）");
  check("ordering_cost", (v) => v > 0, "0 より大きい値にしてください");
  check("service_level", (v) => v > 0 && v < 1, "0 と 1 の間にしてください（例: 0.95）");
  check("cost_per_unit_km", (v) => v >= 0, "0 以上にしてください");

  if (p.lead_time_mode === "common") {
    check("common_lead_time_days", (v) => v > 0, "1 日以上にしてください");
  } else {
    for (const w of warehouses) {
      const v = p.lead_times_days[w.ID];
      if (!Number.isFinite(v)) errs.push(`${w.name} のリードタイムを入力してください`);
      else if (v <= 0) errs.push(`${w.name} のリードタイムは 1 日以上にしてください`);
    }
  }
  return errs;
}

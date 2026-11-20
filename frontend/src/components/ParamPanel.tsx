import { useEffect, useState } from "react";
import type { Params, Warehouse } from "../types";

interface Props {
  params: Params;
  defaults: Params;
  warehouses: Warehouse[];
  errors: string[];
  onChange: (p: Params) => void;
  onSolve: () => void;
  solving: boolean;
}

interface FieldDef {
  key: "unit_purchase_cost" | "annual_carrying_charge" | "ordering_cost" | "service_level" | "cost_per_unit_km";
  label: string;
  unit: string;
  step: number;
}

const FIELDS: FieldDef[] = [
  { key: "unit_purchase_cost", label: "単位購入費", unit: "$/個", step: 1 },
  { key: "annual_carrying_charge", label: "年間保管費率", unit: "比率", step: 0.01 },
  { key: "ordering_cost", label: "発注費", unit: "$/回", step: 500 },
  { key: "service_level", label: "サービス水準", unit: "確率", step: 0.01 },
  { key: "cost_per_unit_km", label: "輸送単価", unit: "$/個・km", step: 0.0001 },
];

/**
 * 数値入力欄。入力中の文字列は自前で持ち、空欄や途中の入力を勝手に 0 に戻さない。
 * 空欄・不正な値のときは NaN を親に渡す（親が検証してエラー表示する）。
 */
function NumberInput({ value, step, onChange }: { value: number; step: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");

  // 「初期値に戻す」やシナリオを開いたときなど、外から値が変わったら表示を合わせる
  useEffect(() => {
    const shown = text.trim() === "" ? NaN : Number(text);
    if (!(Object.is(shown, value) || (Number.isNaN(shown) && Number.isNaN(value)))) {
      setText(Number.isFinite(value) ? String(value) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      step={step}
      value={text}
      className={text.trim() === "" || !Number.isFinite(Number(text)) ? "invalid" : ""}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.trim() === "" ? NaN : Number(e.target.value));
      }}
    />
  );
}

/** 在庫パラメータとリードタイムの入力欄 */
export default function ParamPanel({ params, defaults, warehouses, errors, onChange, onSolve, solving }: Props) {
  const set = (patch: Partial<Params>) => onChange({ ...params, ...patch });

  return (
    <section className="panel">
      <h2>入力パラメータ</h2>
      <div className="fields">
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span>
              {f.label} <small>{f.unit}</small>
            </span>
            <NumberInput value={params[f.key]} step={f.step} onChange={(v) => set({ [f.key]: v })} />
          </label>
        ))}
      </div>

      <h3>リードタイム</h3>
      <div className="segmented" role="radiogroup" aria-label="リードタイムの種類">
        <button
          role="radio"
          aria-checked={params.lead_time_mode === "common"}
          className={params.lead_time_mode === "common" ? "active" : ""}
          onClick={() => set({ lead_time_mode: "common" })}
        >
          全倉庫共通
        </button>
        <button
          role="radio"
          aria-checked={params.lead_time_mode === "per_warehouse"}
          className={params.lead_time_mode === "per_warehouse" ? "active" : ""}
          onClick={() => set({ lead_time_mode: "per_warehouse" })}
        >
          倉庫別
        </button>
      </div>

      {params.lead_time_mode === "common" ? (
        <label className="field">
          <span>
            リードタイム <small>日</small>
          </span>
          <NumberInput
            value={params.common_lead_time_days}
            step={1}
            onChange={(v) => set({ common_lead_time_days: v })}
          />
        </label>
      ) : (
        <div className="fields">
          {warehouses.map((w) => (
            <label key={w.ID} className="field">
              <span>
                {w.name} <small>日</small>
              </span>
              <NumberInput
                value={params.lead_times_days[w.ID]}
                step={1}
                onChange={(v) => set({ lead_times_days: { ...params.lead_times_days, [w.ID]: v } })}
              />
            </label>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <ul className="field-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button className="primary" onClick={onSolve} disabled={solving || errors.length > 0}>
          {solving ? "計算中…" : "最適化を実行"}
        </button>
        <button onClick={() => onChange(defaults)} disabled={solving}>
          初期値に戻す
        </button>
      </div>
    </section>
  );
}

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Scenario } from "../types";
import { COST_COLORS, COST_KEYS, COST_LABELS, int, usd } from "../format";

interface Props {
  scenarios: Scenario[];
  selected: string[];
  currentId: string | null;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const leadTimeText = (s: Scenario) =>
  s.params.lead_time_mode === "common"
    ? `共通 ${s.params.common_lead_time_days} 日`
    : "倉庫別 " + Object.values(s.params.lead_times_days).join("/") + " 日";

/** 保存済みシナリオの一覧と、選んだシナリオの比較 */
export default function ScenarioView({ scenarios, selected, currentId, onToggle, onOpen, onDelete }: Props) {
  if (scenarios.length === 0) {
    return <p className="empty">保存されたシナリオはまだありません。最適化を実行して「シナリオとして保存」を押してください。</p>;
  }
  const compared = scenarios.filter((s) => selected.includes(s.id));
  const chartData = compared.map((s) => ({
    name: s.name,
    ...Object.fromEntries(COST_KEYS.map((k) => [k, Math.round(s.result.cost_breakdown[k])])),
  }));

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>比較</th>
              <th>シナリオ</th>
              <th className="num">総費用</th>
              <th>開設倉庫</th>
              <th className="num">購入費</th>
              <th className="num">サービス水準</th>
              <th>リードタイム</th>
              <th>保存日時</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.id} className={s.id === currentId ? "current" : ""}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${s.name} を比較に含める`}
                    checked={selected.includes(s.id)}
                    onChange={() => onToggle(s.id)}
                  />
                </td>
                <td>
                  {s.name}
                  {s.id === currentId && <span className="tag">表示中</span>}
                </td>
                <td className="num">{usd(s.result.total_cost)}</td>
                <td>{s.result.warehouses.filter((w) => w.open).map((w) => w.name).join("、")}</td>
                <td className="num">${s.params.unit_purchase_cost}</td>
                <td className="num">{s.params.service_level}</td>
                <td>{leadTimeText(s)}</td>
                <td>{s.created_at.replace("T", " ")}</td>
                <td className="row-actions">
                  <button onClick={() => onOpen(s.id)}>開く</button>
                  <button className="danger" onClick={() => onDelete(s.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {compared.length === 0 && <p className="empty">チェックを入れたシナリオの費用をグラフで比較できます。</p>}
      {compared.length > 0 && (
        <>
          <h3>費用の比較</h3>
          <div className="chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ left: 20, right: 20 }}>
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `$${int(v / 1000)}k`} />
                <Tooltip formatter={(v: number, k: string) => [usd(v), COST_LABELS[k as keyof typeof COST_LABELS]]} />
                <Legend formatter={(k: string) => COST_LABELS[k as keyof typeof COST_LABELS]} />
                {COST_KEYS.map((k) => (
                  <Bar key={k} dataKey={k} stackId="a" fill={COST_COLORS[k]} maxBarSize={80} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

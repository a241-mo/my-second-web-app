import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SolveResult } from "../types";
import { COST_COLORS, COST_KEYS, COST_LABELS, int, pct, usd } from "../format";

/** 費用内訳と倉庫別の集計表 */
export default function ResultView({ result }: { result: SolveResult }) {
  const open = result.warehouses.filter((w) => w.open);
  const chartData = open.map((w) => ({
    name: w.name,
    ...Object.fromEntries(COST_KEYS.map((k) => [k, Math.round(w.costs[k])])),
  }));

  return (
    <div className="result">
      <div className="kpis">
        <div className="kpi total">
          <span>総費用</span>
          <strong>{usd(result.total_cost)}</strong>
        </div>
        {COST_KEYS.map((k) => (
          <div className="kpi" key={k} style={{ borderTopColor: COST_COLORS[k] }}>
            <span>{COST_LABELS[k]}</span>
            <strong>{usd(result.cost_breakdown[k])}</strong>
            <small>{pct(result.cost_breakdown[k] / result.total_cost)}</small>
          </div>
        ))}
      </div>

      <h3>開設倉庫ごとの費用内訳</h3>
      <div className="chart">
        <ResponsiveContainer width="100%" height={60 + 48 * chartData.length}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" tickFormatter={(v) => `$${int(v / 1000)}k`} />
            <YAxis type="category" dataKey="name" width={80} />
            <Tooltip formatter={(v: number, k: string) => [usd(v), COST_LABELS[k as keyof typeof COST_LABELS]]} />
            <Legend formatter={(k: string) => COST_LABELS[k as keyof typeof COST_LABELS]} />
            {COST_KEYS.map((k) => (
              <Bar key={k} dataKey={k} stackId="a" fill={COST_COLORS[k]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3>倉庫別の集計</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>倉庫</th>
              <th>状態</th>
              <th className="num">顧客数</th>
              <th className="num">需要計</th>
              <th className="num">容量使用率</th>
              <th className="num">リードタイム</th>
              <th className="num">安全在庫</th>
              <th className="num">EOQ</th>
              <th className="num">費用計</th>
            </tr>
          </thead>
          <tbody>
            {result.warehouses.map((w) => (
              <tr key={w.id} className={w.open ? "" : "closed"}>
                <td>{w.name}</td>
                <td>{w.open ? "開設" : "閉鎖"}</td>
                <td className="num">{w.num_customers}</td>
                <td className="num">{int(w.demand)}</td>
                <td className="num">{w.open ? pct(w.utilization) : "–"}</td>
                <td className="num">{w.lead_time_days} 日</td>
                <td className="num">{w.open ? int(w.safety_stock_units) : "–"}</td>
                <td className="num">{w.open ? int(w.eoq) : "–"}</td>
                <td className="num">
                  {usd(COST_KEYS.reduce((s, k) => s + w.costs[k], 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        安全在庫係数 z = {result.safety_stock_factor.toFixed(3)}。安全在庫 = z·√L·σ（σ は割当顧客の需要の標準偏差を合成したもの）。
      </p>
    </div>
  );
}

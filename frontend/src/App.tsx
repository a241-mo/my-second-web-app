import { useEffect, useState } from "react";
import { api } from "./api";
import type { Network, Params, Scenario, SolveResult } from "./types";
import { validateParams } from "./validate";
import ParamPanel from "./components/ParamPanel";
import NetworkMap from "./components/NetworkMap";
import ResultView from "./components/ResultView";
import ScenarioView from "./components/ScenarioView";

type Tab = "result" | "scenarios" | "log";

const sameParams = (a: Params | null, b: Params | null) => JSON.stringify(a) === JSON.stringify(b);

export default function App() {
  const [network, setNetwork] = useState<Network | null>(null);
  const [params, setParams] = useState<Params | null>(null);
  // 表示中の結果と、その結果を出したときの入力（入力欄を編集しても保存内容がずれないように分けて持つ）
  const [result, setResult] = useState<SolveResult | null>(null);
  const [resultParams, setResultParams] = useState<Params | null>(null);
  const [resultLabel, setResultLabel] = useState("");
  // 表示中の結果が保存済みシナリオなら、その ID（同じ結果の二重保存を防ぐ）
  const [savedId, setSavedId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [scenarioName, setScenarioName] = useState("");
  const [tab, setTab] = useState<Tab>("result");
  const [solving, setSolving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshScenarios = () => api.listScenarios().then(setScenarios);

  const load = () => {
    setError("");
    api
      .network()
      .then((n) => {
        setNetwork(n);
        setParams((p) => p ?? n.default_params);
      })
      .catch((e: Error) => setError(e.message));
    refreshScenarios().catch(() => {});
  };
  useEffect(load, []);

  // 一時的なお知らせは 3 秒で消す
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const inputErrors = network && params ? validateParams(params, network.warehouses) : [];
  const solved = result && (result.status === "solved" || result.status === "limit");
  const stale = !!solved && !sameParams(params, resultParams);

  const solve = async () => {
    if (!params || inputErrors.length > 0) return;
    setSolving(true);
    setError("");
    try {
      const r = await api.solve(params);
      setResult(r);
      setResultParams(params);
      setResultLabel("未保存の結果");
      setSavedId(null);
      const ok = r.status === "solved" || r.status === "limit";
      setTab(ok ? "result" : "log");
      if (!ok) setError(`最適化に失敗しました: ${r.message}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSolving(false);
    }
  };

  const save = async () => {
    const name = scenarioName.trim();
    if (!result || !resultParams || !name || savedId) return;
    try {
      const s = await api.saveScenario(name, resultParams, result);
      setScenarioName("");
      setResultLabel(s.name);
      setSavedId(s.id);
      setSelected((sel) => [...sel, s.id]);
      setNotice(`シナリオ「${s.name}」を保存しました`);
      await refreshScenarios();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openScenario = async (id: string) => {
    try {
      const s = await api.getScenario(id);
      setParams(s.params);
      setResult(s.result);
      setResultParams(s.params);
      setResultLabel(s.name);
      setSavedId(s.id);
      setError("");
      setTab("result");
    } catch (e) {
      setError((e as Error).message);
      refreshScenarios().catch(() => {});
    }
  };

  const deleteScenario = async (id: string) => {
    const s = scenarios.find((x) => x.id === id);
    if (!window.confirm(`シナリオ「${s?.name}」を削除しますか？`)) return;
    try {
      await api.deleteScenario(id);
      setNotice(`シナリオ「${s?.name}」を削除しました`);
    } catch (e) {
      setError((e as Error).message);
    }
    setSelected((sel) => sel.filter((x) => x !== id));
    if (savedId === id) {
      // 表示中の結果は残すが、保存済みではなくなる
      setSavedId(null);
      setResultLabel("未保存の結果（シナリオは削除済み）");
    }
    await refreshScenarios().catch(() => {});
  };

  const toggle = (id: string) =>
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  const staleBanner = stale && (
    <div className="stale">
      入力が変更されています。表示中の結果は変更前の入力によるものです。
      <button onClick={solve} disabled={solving || inputErrors.length > 0}>
        再計算
      </button>
    </div>
  );

  return (
    <div className="app">
      <header>
        <h1>在庫プーリング最適化</h1>
        <p>倉庫の開設と顧客の割当を決めて、固定費・発注保管費・安全在庫費・輸送費の合計を最小化します（AMPL + Gurobi）</p>
      </header>

      {error && (
        <div className="error" role="alert">
          <span>{error}</span>
          {!network && <button onClick={load}>再読み込み</button>}
          <button className="close" aria-label="閉じる" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}

      <div className="layout">
        <aside>
          {network && params && (
            <ParamPanel
              params={params}
              defaults={network.default_params}
              warehouses={network.warehouses}
              errors={inputErrors}
              onChange={setParams}
              onSolve={solve}
              solving={solving}
            />
          )}
          {solved && (
            <section className="panel">
              <h2>シナリオとして保存</h2>
              <p className="muted">表示中の結果: {resultLabel}</p>
              {savedId ? (
                <p className="muted">この結果は保存済みです。別の条件で最適化すると新しく保存できます。</p>
              ) : (
                <div className="save-row">
                  <input
                    placeholder="例: 購入費 $100"
                    maxLength={100}
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    // 日本語入力の変換確定の Enter では保存しない
                    onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && save()}
                  />
                  <button onClick={save} disabled={!scenarioName.trim()}>
                    保存
                  </button>
                </div>
              )}
            </section>
          )}
        </aside>

        <main>
          <section className="panel map-panel">
            {network ? (
              <NetworkMap customers={network.customers} warehouses={network.warehouses} result={solved ? result : null} />
            ) : (
              <div className="map placeholder">{error ? "データを読み込めませんでした" : "読み込み中…"}</div>
            )}
          </section>

          <section className="panel">
            <nav className="tabs">
              <button className={tab === "result" ? "active" : ""} onClick={() => setTab("result")}>
                結果
              </button>
              <button className={tab === "scenarios" ? "active" : ""} onClick={() => setTab("scenarios")}>
                シナリオ比較 <span className="badge">{scenarios.length}</span>
              </button>
              <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>
                ソルバーログ
              </button>
            </nav>

            {tab === "result" &&
              (solved ? (
                <>
                  {staleBanner}
                  <ResultView result={result} />
                </>
              ) : (
                <p className="empty">左の「最適化を実行」を押すと結果が表示されます。</p>
              ))}
            {tab === "scenarios" && (
              <ScenarioView
                scenarios={scenarios}
                selected={selected}
                currentId={savedId}
                onToggle={toggle}
                onOpen={openScenario}
                onDelete={deleteScenario}
              />
            )}
            {tab === "log" &&
              (result ? (
                <>
                  <p className="muted">
                    表示中の結果: {resultLabel} ／ 状態: {result.message}
                    {result.solve_seconds !== undefined && ` ／ 計算時間 ${result.solve_seconds.toFixed(2)} 秒`}
                  </p>
                  <pre className="log">{result.log}</pre>
                </>
              ) : (
                <p className="empty">まだ実行していません。</p>
              ))}
          </section>
        </main>
      </div>
    </div>
  );
}

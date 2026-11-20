import type { Network, Params, Scenario, SolveResult } from "./types";
import { PARAM_LABELS } from "./validate";

/** FastAPI のエラー（文字列 or 検証エラーの配列）を日本語の文にする */
function errorMessage(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: (string | number)[]; msg?: string }) => {
        const field = d.loc?.filter((x) => x !== "body" && x !== "params").map(String).at(-1) ?? "";
        return `${PARAM_LABELS[field] ?? field} の値が正しくありません（${d.msg}）`;
      })
      .join(" / ");
  }
  return `サーバーでエラーが発生しました (${status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  } catch {
    throw new Error("バックエンドに接続できません。FastAPI（ポート 8000）が起動しているか確認してください。");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status >= 500 && !body) {
      throw new Error("バックエンドに接続できません。FastAPI（ポート 8000）が起動しているか確認してください。");
    }
    throw new Error(errorMessage(body?.detail, res.status));
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  network: () => request<Network>("/api/network"),
  solve: (params: Params) =>
    request<SolveResult>("/api/solve", { method: "POST", body: JSON.stringify(params) }),
  listScenarios: () => request<Scenario[]>("/api/scenarios"),
  getScenario: (id: string) => request<Scenario>(`/api/scenarios/${id}`),
  saveScenario: (name: string, params: Params, result: SolveResult) =>
    request<Scenario>("/api/scenarios", {
      method: "POST",
      body: JSON.stringify({ name, params, result }),
    }),
  deleteScenario: (id: string) =>
    request<void>(`/api/scenarios/${id}`, { method: "DELETE" }),
};

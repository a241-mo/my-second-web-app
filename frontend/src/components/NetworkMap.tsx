import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { Customer, SolveResult, Warehouse } from "../types";
import { WAREHOUSE_COLORS, int } from "../format";

interface Props {
  customers: Customer[];
  warehouses: Warehouse[];
  result: SolveResult | null;
}

/** 顧客・倉庫・割当を描く地図。顧客は割当先の倉庫の色で塗る。 */
export default function NetworkMap({ customers, warehouses, result }: Props) {
  const byId = new Map<string, Customer | Warehouse>();
  customers.forEach((c) => byId.set(c.ID, c));
  warehouses.forEach((w) => byId.set(w.ID, w));

  const assignedTo = new Map<string, string>();
  result?.assignments.forEach((a) => assignedTo.set(a.customer, a.warehouse));
  const isOpen = (id: string) => result?.warehouses.find((w) => w.id === id)?.open ?? true;
  const maxDemand = Math.max(...customers.map((c) => c.demand));

  return (
    // 画面幅によらず全ノードが入るように、全ノードの範囲に合わせて表示する
    <MapContainer
      bounds={[...customers, ...warehouses].map((n) => [n.lat, n.lon] as [number, number])}
      boundsOptions={{ padding: [24, 24] }}
      className="map"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {result?.assignments.map((a) => {
        const w = byId.get(a.warehouse)!;
        const c = byId.get(a.customer)!;
        return (
          <Polyline
            key={`${a.warehouse}-${a.customer}`}
            positions={[
              [w.lat, w.lon],
              [c.lat, c.lon],
            ]}
            pathOptions={{ color: WAREHOUSE_COLORS[a.warehouse] ?? "#666", weight: 2, opacity: 0.55 }}
          />
        );
      })}

      {customers.map((c) => {
        const w = assignedTo.get(c.ID);
        const color = w ? WAREHOUSE_COLORS[w] : "#15803d";
        return (
          <CircleMarker
            key={c.ID}
            center={[c.lat, c.lon]}
            radius={3 + 7 * Math.sqrt(c.demand / maxDemand)}
            pathOptions={{ color: "#fff", weight: 1, fillColor: color, fillOpacity: 0.9 }}
          >
            <Tooltip>
              <b>{c.name}</b>（{c.state}）<br />
              需要 {int(c.demand)} / σ {int(c.sigma)}
              {w && (
                <>
                  <br />
                  割当: {byId.get(w)!.name}
                </>
              )}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {warehouses.map((w) => {
        const open = isOpen(w.ID);
        return (
          <CircleMarker
            key={w.ID}
            center={[w.lat, w.lon]}
            radius={11}
            pathOptions={{
              color: open ? "#111827" : "#9ca3af",
              weight: 3,
              fillColor: open ? WAREHOUSE_COLORS[w.ID] : "#e5e7eb",
              fillOpacity: 1,
              dashArray: open ? undefined : "3 3",
            }}
          >
            {/* 常時表示は開設倉庫だけ（閉鎖倉庫はマウスを乗せたとき）。
                permanent は作成後に変えても反映されないので、key で作り直す */}
            <Tooltip
              key={result && open ? "on" : "off"}
              permanent={!!result && open}
              direction="top"
              offset={[0, -10]}
            >
              {w.name}
              {result && (open ? "（開設）" : "（閉鎖）")}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

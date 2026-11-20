// バックエンド API の入出力の型

export interface Customer {
  ID: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  demand: number;
  sigma: number;
}

export interface Warehouse {
  ID: string;
  name: string;
  lat: number;
  lon: number;
  fixed_cost: number;
  capacity: number;
}

export interface Params {
  unit_purchase_cost: number;
  annual_carrying_charge: number;
  ordering_cost: number;
  service_level: number;
  cost_per_unit_km: number;
  lead_time_mode: "common" | "per_warehouse";
  common_lead_time_days: number;
  lead_times_days: Record<string, number>;
}

export interface Network {
  customers: Customer[];
  warehouses: Warehouse[];
  default_params: Params;
}

export type CostKey = "fixed" | "ordering_holding" | "safety_stock" | "transportation";
export type Costs = Record<CostKey, number>;

export interface WarehouseResult {
  id: string;
  name: string;
  open: boolean;
  num_customers: number;
  demand: number;
  capacity: number;
  utilization: number;
  lead_time_days: number;
  demand_sd: number;
  safety_stock_units: number;
  eoq: number;
  costs: Costs;
}

export interface SolveResult {
  status: string;
  message: string;
  total_cost: number;
  cost_breakdown: Costs;
  safety_stock_factor: number;
  warehouses: WarehouseResult[];
  assignments: { warehouse: string; customer: string }[];
  solve_seconds: number;
  log: string;
}

export interface Scenario {
  id: string;
  name: string;
  created_at: string;
  params: Params;
  result: SolveResult;
}

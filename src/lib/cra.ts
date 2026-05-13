export const CRA_KM_RATE = 0.7; // CAD per km, first 5,000 km (2026)
export const HST_THRESHOLD = 30000; // CAD rolling 12mo
export const STALE_DAYS = 30;

export const cad = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const daysBetween = (a: string | Date, b: string | Date = new Date()) => {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
};

export function landedCost(c: { purchase_price?: number | null; helper_cost?: number | null; refurb_cost?: number | null; transport_cost?: number | null }) {
  return Number(c.purchase_price ?? 0) + Number(c.helper_cost ?? 0) + Number(c.refurb_cost ?? 0) + Number(c.transport_cost ?? 0);
}

export function profit(c: { sold_price?: number | null; list_price?: number | null; status: string; purchase_price?: number | null; helper_cost?: number | null; refurb_cost?: number | null; transport_cost?: number | null }) {
  const lc = landedCost(c);
  const sale = c.status === "sold" ? Number(c.sold_price ?? 0) : Number(c.list_price ?? 0);
  return sale - lc;
}

export function tripDeduction(km: number, roundTrip: boolean) {
  return Number(km ?? 0) * (roundTrip ? 2 : 1) * CRA_KM_RATE;
}

export function tripKmTotal(km: number, roundTrip: boolean) {
  return Number(km ?? 0) * (roundTrip ? 2 : 1);
}

export function needsAttention(c: { defects?: string | null; work_done?: string | null; notes?: string | null; condition?: string | null }) {
  const text = `${c.defects ?? ""} ${c.work_done ?? ""} ${c.notes ?? ""} ${c.condition ?? ""}`.toLowerCase();
  return /needs\s+(work|cleaning|repair|fixing)/.test(text);
}

import { Link } from "@tanstack/react-router";
import { StatusBadge } from "./StatusBadge";
import { cad, daysBetween, landedCost, profit, STALE_DAYS } from "@/lib/cra";
import type { Database } from "@/integrations/supabase/types";

type Chair = Database["public"]["Tables"]["chairs"]["Row"];

export function ChairCard({ chair }: { chair: Chair }) {
  const days = chair.status === "sold" && chair.date_sold
    ? daysBetween(chair.date_acquired, chair.date_sold)
    : daysBetween(chair.date_acquired);
  const stale = chair.status !== "sold" && days > STALE_DAYS;
  const lc = landedCost(chair);
  const p = profit(chair);
  return (
    <Link
      to="/app/inventory/$chairId"
      params={{ chairId: chair.id }}
      className="block rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-muted-foreground tracking-wider">{chair.sku}</p>
          <h3 className="font-semibold text-base truncate">{chair.brand}{chair.model ? ` · ${chair.model}` : ""}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {chair.storage_unit ?? "—"} · {chair.condition ?? "—"} · {days}d
          </p>
        </div>
        <StatusBadge status={chair.status} stale={stale} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/60 py-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cost</p>
          <p className="text-sm font-semibold tabular-nums">{cad(lc)}</p>
        </div>
        <div className="rounded-lg bg-muted/60 py-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">List</p>
          <p className="text-sm font-semibold tabular-nums">{chair.list_price ? cad(chair.list_price) : "—"}</p>
        </div>
        <div className={"rounded-lg py-1.5 " + (p >= 0 ? "bg-[oklch(0.95_0.06_152)]" : "bg-[oklch(0.95_0.06_25)]")}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{chair.status === "sold" ? "Profit" : "Est"}</p>
          <p className={"text-sm font-semibold tabular-nums " + (p >= 0 ? "text-[oklch(0.4_0.14_152)]" : "text-destructive")}>{cad(p)}</p>
        </div>
      </div>
    </Link>
  );
}

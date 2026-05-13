import { Link, useNavigate } from "@tanstack/react-router";
import { StatusBadge } from "./StatusBadge";
import { cad, daysBetween, landedCost, needsAttention, profit, STALE_DAYS } from "@/lib/cra";
import { Pencil, AlertTriangle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Chair = Database["public"]["Tables"]["chairs"]["Row"];

export function ChairCard({ chair, draggable }: { chair: Chair; draggable?: boolean }) {
  const nav = useNavigate();
  const days = chair.status === "sold" && chair.date_sold
    ? daysBetween(chair.date_acquired, chair.date_sold)
    : daysBetween(chair.date_acquired);
  const stale = chair.status !== "sold" && days > STALE_DAYS;
  const lc = landedCost(chair);
  const p = profit(chair);
  const attention = needsAttention(chair);
  return (
    <Link
      to="/app/inventory/$chairId"
      params={{ chairId: chair.id }}
      draggable={false}
      className="block rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow select-none"
      onDragStart={(e) => e.preventDefault()}
      style={draggable ? { touchAction: "pan-y" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-muted-foreground tracking-wider">{chair.sku}</p>
          <h3 className="font-semibold text-base truncate">{chair.brand}{chair.model ? ` · ${chair.model}` : ""}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {chair.storage_unit ?? "—"} · {chair.condition ?? "—"} · {days}d
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={chair.status} stale={stale} />
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); nav({ to: "/app/chair/$chairId/edit", params: { chairId: chair.id } }); }}
            aria-label="Edit chair"
            className="h-8 w-8 grid place-items-center rounded-full border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {attention && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[oklch(0.85_0.12_75)] bg-[oklch(0.97_0.06_85)] px-3 py-2 text-xs font-medium text-[oklch(0.4_0.16_60)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>⚠️ Hey, this {chair.brand.toLowerCase().includes("chair") ? chair.brand : "chair"} needs work please do it!</span>
        </div>
      )}
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

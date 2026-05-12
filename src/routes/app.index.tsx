import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { Stat } from "@/components/Stat";
import { cad, daysBetween, HST_THRESHOLD, landedCost, profit, STALE_DAYS } from "@/lib/cra";
import { TrendingUp, Package, Tag, AlertTriangle, Banknote, Clock, Calendar, BarChart3, ArrowRight, Sparkles, ChevronRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import { ListChairSheet } from "@/components/ListChairSheet";
import type { Database } from "@/integrations/supabase/types";

type Chair = Database["public"]["Tables"]["chairs"]["Row"];

export const Route = createFileRoute("/app/")({ component: Dashboard });

function Dashboard() {
  const { team } = useTeam();
  const [listChair, setListChair] = useState<Chair | null>(null);
  const { data: chairs = [] } = useQuery({
    queryKey: ["chairs", team?.id],
    enabled: !!team,
    queryFn: async () => {
      const { data, error } = await supabase.from("chairs").select("*").eq("team_id", team!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const inStock = chairs.filter((c) => c.status !== "sold");
  const sold = chairs.filter((c) => c.status === "sold");
  const unlisted = chairs.filter((c) => c.status === "in_stock" && !c.date_listed);
  const cashInvested = inStock.reduce((s, c) => s + landedCost(c), 0);
  const totalProfit = sold.reduce((s, c) => s + profit(c), 0);
  const listedValue = chairs.filter((c) => c.status === "listed").reduce((s, c) => s + Number(c.list_price ?? 0), 0);
  const stale = inStock.filter((c) => daysBetween(c.date_acquired) > STALE_DAYS);

  const avgProfit = sold.length ? totalProfit / sold.length : 0;
  const avgDays = sold.length
    ? sold.reduce((s, c) => s + (c.date_sold ? daysBetween(c.date_acquired, c.date_sold) : 0), 0) / sold.length
    : 0;
  const avgPerDay = avgDays ? avgProfit / avgDays : 0;

  // HST rolling 12 month
  const since = new Date(); since.setFullYear(since.getFullYear() - 1);
  const rolling12 = sold.filter((c) => c.date_sold && new Date(c.date_sold) >= since)
    .reduce((s, c) => s + Number(c.sold_price ?? 0), 0);
  const hstPct = Math.min(rolling12 / HST_THRESHOLD, 1.2);
  const hstTone = hstPct >= 1 ? "destructive" : hstPct >= 0.8 ? "warning" : "success";
  const hstBar = hstPct >= 1 ? "bg-destructive" : hstPct >= 0.8 ? "bg-[oklch(0.78_0.15_75)]" : "bg-[oklch(0.65_0.16_152)]";

  // Top brands by volume
  const brandCounts = chairs.reduce<Record<string, number>>((acc, c) => {
    acc[c.brand] = (acc[c.brand] ?? 0) + 1;
    return acc;
  }, {});
  const topBrands = Object.entries(brandCounts)
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Attention alerts
  const missingPriceCount = inStock.filter((c) => !c.list_price && c.status === "listed").length;
  const missingCostCount = chairs.filter((c) => !c.purchase_price).length;

  return (
    <div className="px-4 pt-4 pb-8 space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {unlisted.length > 0 && (
        <div className="rounded-2xl border border-[oklch(0.85_0.12_75)] bg-[oklch(0.97_0.06_85)] p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-[oklch(0.5_0.16_60)]" />
            <h2 className="text-sm font-semibold text-[oklch(0.35_0.16_60)]">Action Required</h2>
          </div>
          <p className="text-sm text-[oklch(0.4_0.16_60)] mb-3">
            {unlisted.length} chair{unlisted.length === 1 ? "" : "s"} need{unlisted.length === 1 ? "s" : ""} to be listed
          </p>
          <ul className="space-y-1.5">
            {unlisted.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setListChair(c)}
                  className="w-full flex items-center justify-between rounded-lg bg-card/80 hover:bg-card border border-[oklch(0.9_0.08_75)] px-3 py-2 text-left transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-mono text-muted-foreground">{c.sku}</span>
                    <span className="block text-sm font-medium truncate">{c.brand}{c.model ? ` · ${c.model}` : ""}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    {daysBetween(c.date_acquired)}d
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Capital Deployed" value={cad(cashInvested)} hint="sitting in your storage" icon={Banknote} />
        <Stat label="Total Profit" value={cad(totalProfit)} hint={`${sold.length} sold`} tone="success" icon={TrendingUp} />
        <Stat label="Active Listings Value" value={cad(listedValue)} hint="Active listings" icon={Tag} />
        <Stat label="Stale Chairs" value={stale.length} hint=">30 days" tone={stale.length ? "warning" : "default"} icon={Clock} />
      </div>

      {/* HST Watch */}
      <div className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">HST Watch · Rolling 12mo</p>
            <p className="text-xl font-semibold tabular-nums mt-0.5">{cad(rolling12)} <span className="text-sm text-muted-foreground font-normal">/ {cad(HST_THRESHOLD)}</span></p>
          </div>
          <span className={"text-xs font-semibold rounded-full px-2 py-1 " + (hstTone === "destructive" ? "bg-destructive/10 text-destructive" : hstTone === "warning" ? "bg-[oklch(0.95_0.08_75)] text-[oklch(0.4_0.16_60)]" : "bg-[oklch(0.95_0.06_152)] text-[oklch(0.4_0.14_152)]")}>
            {Math.round(hstPct * 100)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={"h-full transition-all " + hstBar} style={{ width: `${Math.min(hstPct * 100, 100)}%` }} />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-2">Ontario · CRA threshold</p>
        <p className="text-xs text-muted-foreground mt-1">
          {hstPct >= 1 ? "Over threshold — register for HST with CRA." : hstPct >= 0.8 ? "Approaching threshold — start preparing for HST registration." : "On track."}
        </p>
      </div>

      {/* Performance */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Performance</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Avg Profit / Chair" value={cad(avgProfit)} icon={TrendingUp} />
          <Stat label="Avg Days to Sell" value={Math.round(avgDays) || "—"} hint="days" icon={Calendar} />
          <Stat label="Profit / Day Held" value={cad(avgPerDay)} icon={BarChart3} />
          <Stat label="Sold / In Stock" value={`${sold.length} / ${inStock.length}`} icon={Package} />
        </div>
      </div>

      {/* Top brands */}
      {topBrands.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold mb-3">Top Brands by Volume</h2>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBrands} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
                <XAxis dataKey="brand" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {topBrands.map((_, i) => <Cell key={i} fill="var(--primary)" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Alerts */}
      {(stale.length > 0 || missingPriceCount > 0 || missingCostCount > 0) && (
        <div className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-[oklch(0.6_0.15_60)]" /> Attention</h2>
          <ul className="space-y-2 text-sm">
            {stale.length > 0 && (
              <Alert label={`${stale.length} stale chairs (>30 days)`} to="/app/inventory" qs={{ filter: "stale" }} />
            )}
            {missingPriceCount > 0 && (
              <Alert label={`${missingPriceCount} listed chairs missing list price`} to="/app/inventory" qs={{ filter: "listed" }} />
            )}
            {missingCostCount > 0 && (
              <Alert label={`${missingCostCount} chairs missing purchase price`} to="/app/inventory" qs={{ filter: "all" }} />
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Alert({ label, to }: { label: string; to: string; qs?: Record<string, string> }) {
  return (
    <li>
      <Link to={to} className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/60 hover:bg-muted">
        <span>{label}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </li>
  );
}

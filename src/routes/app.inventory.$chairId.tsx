import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { cad, daysBetween, landedCost, profit, STALE_DAYS } from "@/lib/cra";
import { ChevronLeft } from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  fb_marketplace: "Facebook Marketplace", kijiji: "Kijiji",
  estate_sale: "Estate Sale / Garage Sale", supplier: "Supplier / Wholesale", other: "Other (eBay, etc.)",
};

export const Route = createFileRoute("/app/inventory/$chairId")({ component: ChairDetail });

function ChairDetail() {
  const { chairId } = Route.useParams();
  const nav = useNavigate();
  const { data: chair, isLoading } = useQuery({
    queryKey: ["chair", chairId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chairs").select("*").eq("id", chairId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!chair) return <p className="p-6 text-sm">Not found.</p>;

  const days = chair.status === "sold" && chair.date_sold ? daysBetween(chair.date_acquired, chair.date_sold) : daysBetween(chair.date_acquired);
  const stale = chair.status !== "sold" && days > STALE_DAYS;
  const lc = landedCost(chair);
  const p = profit(chair);

  return (
    <div className="px-4 pt-4 pb-24">
      <button onClick={() => nav({ to: "/app/inventory" })} className="flex items-center text-sm text-muted-foreground mb-3"><ChevronLeft className="h-4 w-4" /> My Stock</button>
      <p className="text-xs font-mono text-muted-foreground tracking-wider">{chair.sku}</p>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="text-2xl font-bold">{chair.brand}{chair.model ? ` · ${chair.model}` : ""}</h1>
        <StatusBadge status={chair.status} stale={stale} />
      </div>
      <p className="text-sm text-muted-foreground mt-1">{chair.condition ?? "—"} · {chair.storage_unit ?? "—"} · {days} days held</p>

      <Section title="Flip Summary">
        <KV k="Bought from" v={SOURCE_LABELS[chair.source] ?? chair.source} />
        <KV k="Days in storage" v={`${days} days`} />
        <KV k={chair.status === "sold" ? "Profit made" : "Projected profit"} v={cad(p)} bold tone={p >= 0 ? "success" : "destructive"} />
        <KV k="Profit / day held" v={days > 0 ? cad(p / days) : "—"} />
      </Section>

      <Section title="Financials">
        <KV k="Purchase" v={cad(chair.purchase_price)} />
        <KV k="Helper" v={cad(chair.helper_cost)} />
        <KV k="Refurb" v={cad(chair.refurb_cost)} />
        <KV k="Transport" v={cad(chair.transport_cost)} />
        <KV k="Landed cost" v={cad(lc)} bold />
        <KV k="List price" v={chair.list_price ? cad(chair.list_price) : "—"} />
        <KV k="Sold price" v={chair.sold_price ? cad(chair.sold_price) : "—"} />
        <KV k={chair.status === "sold" ? "Profit" : "Projected profit"} v={cad(p)} bold tone={p >= 0 ? "success" : "destructive"} />
      </Section>

      {(chair.trip_km || chair.trip_start) && (
        <Section title="Pickup trip">
          <KV k="Route" v={`${chair.trip_start ?? "—"} → ${chair.trip_end ?? "—"}`} />
          <KV k="Km" v={`${Number(chair.trip_km) * (chair.trip_round_trip ? 2 : 1)} km`} />
        </Section>
      )}

      {(chair.defects || chair.work_done || chair.notes) && (
        <Section title="Notes">
          {chair.defects && <Note label="Defects" text={chair.defects} />}
          {chair.work_done && <Note label="Work done" text={chair.work_done} />}
          {chair.notes && <Note label="Notes" text={chair.notes} />}
        </Section>
      )}

      <Section title="Dates">
        <KV k="Acquired" v={chair.date_acquired} />
        {chair.date_listed && <KV k="Listed" v={chair.date_listed} />}
        {chair.date_sold && <KV k="Sold" v={chair.date_sold} />}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h2>
      <div className="rounded-2xl bg-card border border-border divide-y divide-border">{children}</div>
    </div>
  );
}
function KV({ k, v, bold, tone }: { k: string; v: string; bold?: boolean; tone?: "success" | "destructive" }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={"tabular-nums " + (bold ? "font-semibold " : "") + (tone === "success" ? "text-[oklch(0.4_0.14_152)]" : tone === "destructive" ? "text-destructive" : "")}>{v}</span>
    </div>
  );
}
function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="px-4 py-2.5 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}

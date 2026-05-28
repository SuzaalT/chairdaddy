import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { ChairCard } from "@/components/ChairCard";
import { Input } from "@/components/ui/input";
import { Search, Folder, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/app/sold")({ component: SoldItems });

function SoldItems() {
  const { team } = useTeam();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  const { data: chairs = [], isLoading } = useQuery({
    queryKey: ["chairs", team?.id],
    enabled: !!team,
    queryFn: async () => {
      const { data, error } = await supabase.from("chairs").select("*").eq("team_id", team!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!team) return;
    const ch = supabase
      .channel(`chairs-sold:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chairs", filter: `team_id=eq.${team.id}` },
        () => qc.invalidateQueries({ queryKey: ["chairs", team.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [team, qc]);

  const sold = useMemo(() => {
    return chairs.filter((c) => {
      if (c.status !== "sold") return false;
      if (q) {
        const t = q.toLowerCase();
        const hay = [c.sku, c.brand, c.model, c.notes, c.condition, c.storage_unit, c.buyer_name].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [chairs, q]);

  const brandFolders = useMemo(() => {
    const counts = sold.reduce<Record<string, number>>((acc, c) => {
      const b = c.brand || "Unknown";
      acc[b] = (acc[b] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [sold]);

  const modelFolders = useMemo(() => {
    if (!brand) return [];
    const inBrand = sold.filter((c) => (c.brand || "Unknown") === brand);
    const counts = inBrand.reduce<Record<string, number>>((acc, c) => {
      const m = c.model || "No model";
      acc[m] = (acc[m] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [sold, brand]);

  const items = useMemo(() => {
    if (!brand || !model) return [];
    return sold.filter((c) => (c.brand || "Unknown") === brand && (c.model || "No model") === model);
  }, [sold, brand, model]);

  const title = model ?? brand ?? "Sold Items";

  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <span className="text-xs text-muted-foreground">
          {model
            ? `${items.length} item${items.length === 1 ? "" : "s"}`
            : brand
            ? `${modelFolders.length} model${modelFolders.length === 1 ? "" : "s"}`
            : `${brandFolders.length} brand${brandFolders.length === 1 ? "" : "s"} · ${sold.length} sold`}
        </span>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU, brand, buyer…" className="pl-9 h-10" />
      </div>

      {(brand || model) && (
        <button
          onClick={() => (model ? setModel(null) : setBrand(null))}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-3 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> {model ? brand : "All brands"}
        </button>
      )}

      {isLoading ? (
        <p className="text-center text-muted-foreground text-sm py-12">Loading…</p>
      ) : !brand ? (
        brandFolders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No sold items yet. Once you mark a chair as sold, it lands here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {brandFolders.map((b) => (
              <button
                key={b.name}
                onClick={() => setBrand(b.name)}
                className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Folder className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.count} sold</p>
                </div>
              </button>
            ))}
          </div>
        )
      ) : !model ? (
        <div className="grid grid-cols-2 gap-3">
          {modelFolders.map((m) => (
            <button
              key={m.name}
              onClick={() => setModel(m.name)}
              className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <Folder className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.count} sold</p>
              </div>
            </button>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No sold items here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <ChairCard key={c.id} chair={c} readOnly />
          ))}
        </div>
      )}
    </div>
  );
}

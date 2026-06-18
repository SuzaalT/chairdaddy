import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { ChairCard } from "@/components/ChairCard";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListChairSheet } from "@/components/ListChairSheet";
import { Input } from "@/components/ui/input";
import { Plus, Search, Sparkles, Folder, ChevronLeft, CheckSquare } from "lucide-react";
import { daysBetween, STALE_DAYS } from "@/lib/cra";
import { cn } from "@/lib/utils";
import { usePermission, PERMISSIONS } from "@/hooks/use-permission";
import { toast } from "sonner";
import { useMultiSelect, useLongPress } from "@/hooks/use-multi-select";
import { SelectionBar } from "@/components/SelectionBar";
import { Checkbox } from "@/components/ui/checkbox";
import type { Database } from "@/integrations/supabase/types";

type Chair = Database["public"]["Tables"]["chairs"]["Row"];

type Filter = "all" | "in_stock" | "listed" | "stale";

export const Route = createFileRoute("/app/inventory/")({ component: Inventory });

function Inventory() {
  const { team } = useTeam();
  const qc = useQueryClient();
  const canDelete = usePermission(PERMISSIONS.CHAIR_DELETE);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [listChair, setListChair] = useState<Chair | null>(null);
  const sel = useMultiSelect();
  const [pendingBulk, setPendingBulk] = useState(false);

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
      .channel(`chairs:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chairs", filter: `team_id=eq.${team.id}` },
        () => qc.invalidateQueries({ queryKey: ["chairs", team.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [team, qc]);

  // Sold items go to the dedicated /app/sold route — exclude here entirely.
  const baseFiltered = useMemo(() => {
    return chairs.filter((c) => {
      if (c.status === "sold") return false;
      if (filter === "in_stock" && c.status !== "in_stock") return false;
      if (filter === "listed" && c.status !== "listed") return false;
      if (filter === "stale" && daysBetween(c.date_acquired) <= STALE_DAYS) return false;
      if (q) {
        const t = q.toLowerCase();
        const hay = [c.sku, c.brand, c.model, c.notes, c.condition, c.storage_unit].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [chairs, filter, q]);

  const brandFolders = useMemo(() => {
    const counts = baseFiltered.reduce<Record<string, number>>((acc, c) => {
      const b = c.brand || "Unknown";
      acc[b] = (acc[b] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [baseFiltered]);

  const modelFolders = useMemo(() => {
    if (!brand) return [];
    const inBrand = baseFiltered.filter((c) => (c.brand || "Unknown") === brand);
    const counts = inBrand.reduce<Record<string, number>>((acc, c) => {
      const m = c.model || "No model";
      acc[m] = (acc[m] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [baseFiltered, brand]);

  const variantFolders = useMemo(() => {
    if (!brand || !model) return [];
    const scoped = baseFiltered.filter((c) => (c.brand || "Unknown") === brand && (c.model || "No model") === model);
    const counts = scoped.reduce<Record<string, number>>((acc, c) => {
      const v = (c as any).variant || "No variant";
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [baseFiltered, brand, model]);

  const items = useMemo(() => {
    if (!brand || !model || !variant) return [];
    return baseFiltered.filter(
      (c) =>
        (c.brand || "Unknown") === brand &&
        (c.model || "No model") === model &&
        (((c as any).variant || "No variant") === variant),
    );
  }, [baseFiltered, brand, model, variant]);

  async function doDelete() {
    if (!pendingDelete) return;
    const { error } = await supabase.from("chairs").delete().eq("id", pendingDelete.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["chairs", team?.id] }); }
    setPendingDelete(null);
  }

  async function doBulkDelete() {
    const ids = Array.from(sel.selected);
    if (!ids.length) return;
    const { error } = await supabase.from("chairs").delete().in("id", ids);
    setPendingBulk(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} item${ids.length === 1 ? "" : "s"} deleted`);
    sel.exit();
    qc.invalidateQueries({ queryKey: ["chairs", team?.id] });
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" }, { id: "in_stock", label: "In Stock" },
    { id: "listed", label: "Listed" }, { id: "stale", label: "Stale" },
  ];

  const title = variant ?? model ?? brand ?? "My Stock";
  const totalActive = chairs.filter((c) => c.status !== "sold").length;

  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <span className="text-xs text-muted-foreground">
          {variant
            ? `${items.length} item${items.length === 1 ? "" : "s"}`
            : model
            ? `${variantFolders.length} variant${variantFolders.length === 1 ? "" : "s"}`
            : brand
            ? `${modelFolders.length} model${modelFolders.length === 1 ? "" : "s"}`
            : `${brandFolders.length} brand${brandFolders.length === 1 ? "" : "s"} · ${totalActive} total`}
        </span>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU, brand, notes…" className="pl-9 h-10" />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-4">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors border",
              filter === f.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {(brand || model || variant) && (
        <button
          onClick={() => (variant ? setVariant(null) : model ? setModel(null) : setBrand(null))}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-3 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> {variant ? model : model ? brand : "All brands"}
        </button>
      )}

      {isLoading ? (
        <p className="text-center text-muted-foreground text-sm py-12">Loading…</p>
      ) : !brand ? (
        brandFolders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No chairs in stock. Hit the marketplaces and add your first flip.</p>
            <Link to="/app/chair/new" className="inline-flex items-center mt-4 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
              <Plus className="h-4 w-4 mr-1.5" /> Add your first flip
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {brandFolders.map((b) => (
              <button
                key={b.name}
                onClick={() => { setBrand(b.name); setModel(null); setVariant(null); }}
                className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Folder className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.count} item{b.count === 1 ? "" : "s"}</p>
                </div>
              </button>
            ))}
          </div>
        )
      ) : !model ? (
        modelFolders.length === 0 ? (
          <div className="text-center py-16"><p className="text-muted-foreground text-sm">No models match.</p></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {modelFolders.map((m) => (
              <button
                key={m.name}
                onClick={() => { setModel(m.name); setVariant(null); }}
                className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Folder className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.count} item{m.count === 1 ? "" : "s"}</p>
                </div>
              </button>
            ))}
          </div>
        )
      ) : !variant ? (
        variantFolders.length === 0 ? (
          <div className="text-center py-16"><p className="text-muted-foreground text-sm">No variants match.</p></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {variantFolders.map((v) => (
              <button
                key={v.name}
                onClick={() => setVariant(v.name)}
                className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Folder className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.count} item{v.count === 1 ? "" : "s"}</p>
                </div>
              </button>
            ))}
          </div>
        )
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No chairs match.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const needsListing = c.status === "in_stock" && !c.date_listed;
            return (
              <div key={c.id} className="relative">
                <SwipeToDelete
                  disabled={!canDelete}
                  onDelete={() => setPendingDelete({ id: c.id, label: `${c.brand}${c.model ? " · " + c.model : ""}` })}
                >
                  <ChairCard chair={c} draggable={canDelete} />
                </SwipeToDelete>
                {needsListing && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setListChair(c); }}
                    className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-[oklch(0.95_0.08_75)] text-[oklch(0.4_0.16_60)] border border-[oklch(0.85_0.12_75)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm hover:brightness-95"
                  >
                    <Sparkles className="h-3 w-3" /> Needs listing
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.label}?`}
        description="This permanently removes the chair and all its data. This cannot be undone."
        onConfirm={doDelete}
      />

      <Link to="/app/chair/new" className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-[var(--shadow-elevated)] hover:scale-105 transition-transform" aria-label="Add chair">
        <Plus className="h-6 w-6" />
      </Link>

      <ListChairSheet chair={listChair} open={!!listChair} onOpenChange={(v) => !v && setListChair(null)} />
    </div>
  );
}

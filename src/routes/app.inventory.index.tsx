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
import { Plus, Search, Sparkles } from "lucide-react";
import { daysBetween, STALE_DAYS } from "@/lib/cra";
import { cn } from "@/lib/utils";
import { usePermission, PERMISSIONS } from "@/hooks/use-permission";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Chair = Database["public"]["Tables"]["chairs"]["Row"];

type Filter = "all" | "in_stock" | "listed" | "stale" | "sold";

export const Route = createFileRoute("/app/inventory/")({ component: Inventory });

function Inventory() {
  const { team } = useTeam();
  const qc = useQueryClient();
  const canDelete = usePermission(PERMISSIONS.CHAIR_DELETE);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [listChair, setListChair] = useState<Chair | null>(null);

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

  const filtered = useMemo(() => {
    return chairs.filter((c) => {
      if (filter === "in_stock" && c.status !== "in_stock") return false;
      if (filter === "listed" && c.status !== "listed") return false;
      if (filter === "sold" && c.status !== "sold") return false;
      if (filter === "stale") {
        if (c.status === "sold") return false;
        if (daysBetween(c.date_acquired) <= STALE_DAYS) return false;
      }
      if (q) {
        const t = q.toLowerCase();
        const hay = [c.sku, c.brand, c.model, c.notes, c.condition, c.storage_unit].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [chairs, filter, q]);

  async function doDelete() {
    if (!pendingDelete) return;
    const { error } = await supabase.from("chairs").delete().eq("id", pendingDelete.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["chairs", team?.id] }); }
    setPendingDelete(null);
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" }, { id: "in_stock", label: "In Stock" },
    { id: "listed", label: "Listed" }, { id: "stale", label: "Stale" }, { id: "sold", label: "Sold" },
  ];

  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold tracking-tight">My Stock</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} of {chairs.length}</span>
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

      {isLoading ? (
        <p className="text-center text-muted-foreground text-sm py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No chairs in stock. Hit the marketplaces and add your first flip.</p>
          <Link to="/app/chair/new" className="inline-flex items-center mt-4 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
            <Plus className="h-4 w-4 mr-1.5" /> Add your first flip
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
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
    </div>
  );
}

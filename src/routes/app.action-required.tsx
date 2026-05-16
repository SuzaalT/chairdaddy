import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { daysBetween } from "@/lib/cra";
import { ListChairSheet } from "@/components/ListChairSheet";
import type { Database } from "@/integrations/supabase/types";

type Chair = Database["public"]["Tables"]["chairs"]["Row"];

export const Route = createFileRoute("/app/action-required")({ component: ActionRequiredPage });

function ActionRequiredPage() {
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

  const unlisted = chairs.filter((c) => c.status === "in_stock" && !c.date_listed);

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/app" className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted -ml-2" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Action Required</h1>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-[oklch(0.5_0.16_60)]" />
        {unlisted.length} chair{unlisted.length === 1 ? "" : "s"} need{unlisted.length === 1 ? "s" : ""} to be listed
      </div>

      {unlisted.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          All caught up — nothing needs to be listed.
        </div>
      ) : (
        <ul className="space-y-2">
          {unlisted.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setListChair(c)}
                className="w-full flex items-center justify-between rounded-xl bg-card hover:bg-muted/40 border border-border px-4 py-3 text-left transition-colors shadow-[var(--shadow-card)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-mono text-muted-foreground">{c.sku}</span>
                  <span className="block text-sm font-medium truncate">
                    {c.brand}{c.model ? ` · ${c.model}` : ""}
                  </span>
                  {c.condition && (
                    <span className="block text-xs text-muted-foreground truncate mt-0.5">{c.condition}</span>
                  )}
                </span>
                <span className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground ml-3">
                  <span className="rounded-full bg-muted px-2 py-0.5">{daysBetween(c.date_acquired)}d</span>
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ListChairSheet chair={listChair} open={!!listChair} onOpenChange={(v) => !v && setListChair(null)} />
    </div>
  );
}

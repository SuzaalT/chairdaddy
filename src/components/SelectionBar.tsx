import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export function SelectionBar({
  count,
  total,
  allSelected,
  onToggleAll,
  onDelete,
}: {
  count: number;
  total: number;
  allSelected: boolean;
  onToggleAll: (on: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-3 pointer-events-none animate-fade-in">
      <div className="pointer-events-auto mx-auto max-w-screen-sm flex items-center gap-3 rounded-2xl bg-card border border-border shadow-[var(--shadow-elevated)] px-3 py-2.5">
        <span className="text-sm font-semibold tabular-nums shrink-0">{count} selected</span>
        <label className="flex items-center gap-2 text-xs text-muted-foreground ml-1 cursor-pointer">
          <Checkbox
            checked={allSelected && total > 0}
            onCheckedChange={(v) => onToggleAll(!!v)}
          />
          Select all
        </label>
        <div className="flex-1" />
        <button
          onClick={onDelete}
          disabled={count === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-destructive text-destructive-foreground px-3.5 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    </div>
  );
}

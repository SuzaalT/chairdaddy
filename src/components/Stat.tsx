import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
  className?: string;
}) {
  const toneColor = {
    default: "text-foreground",
    success: "text-[oklch(0.55_0.16_152)]",
    warning: "text-[oklch(0.6_0.15_60)]",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className={cn("rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", toneColor)}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

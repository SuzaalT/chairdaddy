import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["chair_status"];

const styles: Record<Status, string> = {
  in_stock: "bg-accent text-accent-foreground",
  listed: "bg-[oklch(0.92_0.06_220)] text-[oklch(0.3_0.12_220)]",
  sold: "bg-[oklch(0.92_0.08_152)] text-[oklch(0.3_0.14_152)]",
};
const labels: Record<Status, string> = { in_stock: "In Stock", listed: "Listed", sold: "Sold" };

export function StatusBadge({ status, stale, className }: { status: Status; stale?: boolean; className?: string }) {
  if (stale && status !== "sold") {
    return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[oklch(0.93_0.08_60)] text-[oklch(0.4_0.16_60)]", className)}>Stale</span>;
  }
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", styles[status], className)}>{labels[status]}</span>;
}

import { supabase } from "@/integrations/supabase/client";
import { brandInitials, toTitleCase } from "./text-case";

// SKU format: "<INITIALS> - <Model> <NN>"  (e.g. "HM - Aeron 01")
// Counter is per team + brand-initials + model.
export async function generateSku(
  teamId: string,
  brand: string,
  model?: string | null,
): Promise<string> {
  const initials = brandInitials(brand);
  const modelTitle = toTitleCase(model ?? "");
  const prefix = modelTitle ? `${initials} - ${modelTitle} ` : `${initials} - `;

  const { data } = await supabase
    .from("chairs")
    .select("sku")
    .eq("team_id", teamId)
    .like("sku", `${prefix}%`);

  let max = 0;
  for (const row of data ?? []) {
    const m = row.sku?.match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

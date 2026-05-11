import { supabase } from "@/integrations/supabase/client";

export async function generateSku(teamId: string, brand: string, prefix = "CF"): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2);
  const brandSlug = (brand || "GEN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "GEN";
  const root = `${prefix}-${brandSlug}-${yy}-`;
  const { data } = await supabase
    .from("chairs")
    .select("sku")
    .eq("team_id", teamId)
    .like("sku", `${root}%`)
    .order("sku", { ascending: false })
    .limit(1);
  let n = 1;
  if (data && data[0]?.sku) {
    const m = data[0].sku.match(/-(\d{3,})$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${root}${String(n).padStart(3, "0")}`;
}

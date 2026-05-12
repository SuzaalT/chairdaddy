import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, RotateCw, Sparkles, Tag, Settings } from "lucide-react";
import { toast } from "sonner";
import { callAnthropic } from "@/lib/anthropic";
import { useTeam } from "@/hooks/use-team";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Chair = Database["public"]["Tables"]["chairs"]["Row"];

const PLATFORMS = ["Facebook Marketplace", "Kijiji", "eBay", "Other"] as const;

export function ListChairSheet({ chair, open, onOpenChange }: {
  chair: Chair | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { profile, team } = useTeam();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [price, setPrice] = useState("");
  const [dateListed, setDateListed] = useState(() => new Date().toISOString().slice(0, 10));
  const [platform, setPlatform] = useState<string>("Facebook Marketplace");
  const [saving, setSaving] = useState(false);
  const lastIdRef = useRef<string | null>(null);

  const apiKey = profile?.anthropic_key ?? "";

  async function generate(c: Chair) {
    if (!apiKey) return;
    setBusy(true);
    setOut("");
    try {
      const prompt = `Write a Facebook Marketplace listing for this office chair in Ontario Canada.
Brand: ${c.brand}
Condition: ${c.condition ?? "Good"}
Defects: ${c.defects || "none"}
Work done: ${c.work_done || "none"}
Storage location area: ${c.storage_unit ?? "Ontario"}
Write 2-3 honest sentences then bullet point key features. State pickup location as Ontario. Do not include price — the seller will add it manually.`;
      const text = await callAnthropic({
        apiKey,
        messages: [{ role: "user", content: prompt }],
      });
      setOut(text);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Auto-generate when sheet opens for a new chair
  useEffect(() => {
    if (!open || !chair) return;
    if (lastIdRef.current === chair.id && out) return;
    lastIdRef.current = chair.id;
    setOut("");
    setShowForm(false);
    setPrice("");
    setPlatform("Facebook Marketplace");
    setDateListed(new Date().toISOString().slice(0, 10));
    if (apiKey) void generate(chair);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chair?.id]);

  async function copyText() {
    await navigator.clipboard.writeText(out);
    toast.success("Listing copied");
  }

  async function confirmListed() {
    if (!chair) return;
    if (!price) return toast.error("Listing price required");
    setSaving(true);
    const { error } = await supabase.from("chairs").update({
      status: "listed",
      list_price: Number(price),
      date_listed: dateListed,
      listed_platform: platform,
    }).eq("id", chair.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Listed at $${price} ✓`);
    qc.invalidateQueries({ queryKey: ["chairs", team?.id] });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto p-5">
        {chair && (
          <>
            <SheetHeader className="text-left mb-3">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Generate listing
              </SheetTitle>
            </SheetHeader>

            <div className="rounded-xl bg-muted/60 p-3 mb-4">
              <p className="text-[11px] font-mono text-muted-foreground">{chair.sku}</p>
              <p className="font-semibold">{chair.brand}{chair.model ? ` · ${chair.model}` : ""}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {chair.condition ?? "—"}{chair.work_done ? ` · ${chair.work_done.slice(0, 80)}${chair.work_done.length > 80 ? "…" : ""}` : ""}
              </p>
            </div>

            {!apiKey ? (
              <div className="rounded-xl border border-border p-4 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  Add your Anthropic API key in Settings to auto-generate listings.
                </p>
                <Link to="/app/settings" onClick={() => onOpenChange(false)}>
                  <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-1.5" />Open Settings</Button>
                </Link>
              </div>
            ) : busy ? (
              <div className="rounded-xl border border-border p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating your listing…
              </div>
            ) : out ? (
              <>
                <div className="rounded-xl bg-card border border-border p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{out}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button variant="outline" onClick={copyText}><Copy className="h-4 w-4 mr-1.5" />Copy Listing</Button>
                  <Button variant="outline" onClick={() => generate(chair)}><RotateCw className="h-4 w-4 mr-1.5" />Regenerate</Button>
                </div>

                {!showForm ? (
                  <Button
                    onClick={() => setShowForm(true)}
                    className="w-full mt-3 h-11 bg-[oklch(0.65_0.16_152)] hover:bg-[oklch(0.6_0.16_152)] text-white"
                  >
                    <Tag className="h-4 w-4 mr-1.5" /> Mark as Listed
                  </Button>
                ) : (
                  <div className="mt-4 rounded-xl border border-border p-4 space-y-3">
                    <div>
                      <Label className="text-xs">Listing Price ($)</Label>
                      <Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <Label className="text-xs">Date Listed</Label>
                      <Input type="date" value={dateListed} onChange={(e) => setDateListed(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Platform</Label>
                      <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={confirmListed}
                      disabled={saving || !price}
                      className="w-full h-11 bg-[oklch(0.65_0.16_152)] hover:bg-[oklch(0.6_0.16_152)] text-white"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

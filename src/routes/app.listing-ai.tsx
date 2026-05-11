import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTeam } from "@/hooks/use-team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Loader2, RotateCw, Sparkles } from "lucide-react";
import { callAnthropic } from "@/lib/anthropic";

export const Route = createFileRoute("/app/listing-ai")({ component: ListingAI });

function ListingAI() {
  const { profile } = useTeam();
  const [f, setF] = useState({ brand: "", model: "", condition: "Excellent", features: "", price: "", area: "", defects: "" });
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!profile?.anthropic_key) return toast.error("Add Anthropic API key in Settings");
    if (!f.brand) return toast.error("Brand required");
    setBusy(true);
    try {
      const text = await callAnthropic({
        apiKey: profile.anthropic_key,
        system: "You write concise, persuasive Facebook Marketplace listings for office chairs in Ontario, Canada. 2-3 sentence description followed by bullet point features. CAD pricing. No hashtags. Friendly, professional tone.",
        messages: [{ role: "user", content: `Brand: ${f.brand}\nModel: ${f.model}\nCondition: ${f.condition}\nFeatures: ${f.features}\nAsking price: $${f.price} CAD\nPickup area: ${f.area}\nDefects/notes: ${f.defects}\n\nWrite the FB Marketplace listing now.` }],
      });
      setOut(text);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function copy() {
    await navigator.clipboard.writeText(out);
    toast.success("Copied");
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center gap-2 mb-3">
        <h1 className="text-2xl font-bold tracking-tight">Listing AI</h1>
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Generate a polished FB Marketplace listing in seconds.</p>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Brand</Label><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></div>
          <div><Label className="text-xs">Model</Label><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></div>
        </div>
        <div><Label className="text-xs">Condition</Label>
          <Select value={f.condition} onValueChange={(v) => setF({ ...f, condition: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Like New", "Excellent", "Very Good", "Good", "Fair"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Key features</Label><Textarea rows={2} value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} placeholder="Lumbar support, full mesh, adjustable arms…" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Asking price (CAD)</Label><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
          <div><Label className="text-xs">Pickup area</Label><Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Hamilton" /></div>
        </div>
        <div><Label className="text-xs">Defects / notes</Label><Textarea rows={2} value={f.defects} onChange={(e) => setF({ ...f, defects: e.target.value })} /></div>
        <Button onClick={generate} disabled={busy} className="w-full h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1.5" /> Generate</>}
        </Button>
      </div>

      {out && (
        <div className="mt-5 rounded-2xl bg-card border border-border p-4">
          <p className="whitespace-pre-wrap text-sm">{out}</p>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={copy}><Copy className="h-4 w-4 mr-1.5" />Copy</Button>
            <Button variant="outline" size="sm" onClick={generate}><RotateCw className="h-4 w-4 mr-1.5" />Regenerate</Button>
          </div>
        </div>
      )}
    </div>
  );
}

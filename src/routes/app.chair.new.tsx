import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTeam } from "@/hooks/use-team";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { generateSku } from "@/lib/sku";
import { landedCost, profit, tripDeduction, tripKmTotal, cad, CRA_KM_RATE } from "@/lib/cra";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ChevronLeft, Save, MapPin, AlertTriangle } from "lucide-react";
import { estimateDrivingKm, variancePct, VARIANCE_FLAG_PCT } from "@/lib/distance";

export const Route = createFileRoute("/app/chair/new")({ component: NewChair });

const SOURCES = [
  { v: "fb_marketplace", l: "Facebook Marketplace" }, { v: "kijiji", l: "Kijiji" },
  { v: "estate_sale", l: "Estate Sale / Garage Sale" }, { v: "supplier", l: "Supplier / Wholesale" },
  { v: "other", l: "Other (eBay, etc.)" },
] as const;

function NewChair() {
  const { team } = useTeam();
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [section, setSection] = useState<"details" | "costs" | "trip" | "proof">("details");

  const [f, setF] = useState({
    brand: "", model: "", source: "fb_marketplace" as "fb_marketplace" | "kijiji" | "supplier" | "estate_sale" | "other",
    date_acquired: new Date().toISOString().slice(0, 10),
    storage_unit: "", condition: "Good", defects: "", status: "in_stock" as "in_stock" | "listed" | "sold",
    list_price: "", date_listed: "", sold_price: "", date_sold: "", notes: "",
    purchase_price: "", helper_cost: "", refurb_cost: "", transport_cost: "", work_done: "",
    trip_start: "", trip_end: "", trip_km: "", trip_estimated_km: "", trip_round_trip: false,
    listing_url: "",
  });
  const [estimating, setEstimating] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!team) return;
    supabase.from("storage_units").select("*").eq("team_id", team.id).then(({ data }) => {
      setUnits(data ?? []);
      if (data?.[0] && !f.storage_unit) setF((p) => ({ ...p, storage_unit: data[0].name }));
    });
  }, [team]);

  const num = (s: string) => (s === "" ? 0 : Number(s));
  const autoTransport = num(f.trip_km) * (f.trip_round_trip ? 2 : 1) * CRA_KM_RATE;
  const transportCostUsed = f.transport_cost === "" && f.trip_km ? autoTransport : num(f.transport_cost);
  const lc = landedCost({ purchase_price: num(f.purchase_price), helper_cost: num(f.helper_cost), refurb_cost: num(f.refurb_cost), transport_cost: transportCostUsed });
  const projectedProfit = num(f.list_price) - lc;

  async function uploadOne(bucket: string, file: File): Promise<string | null> {
    const path = `${team!.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) { toast.error(`Upload failed: ${error.message}`); return null; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function save() {
    if (!team || !user) return;
    if (!f.brand) { toast.error("Brand is required"); setSection("details"); return; }
    if (!f.purchase_price) { toast.error("Purchase price is required"); setSection("costs"); return; }
    setBusy(true);
    try {
      const sku = await generateSku(team.id, f.brand);
      const proofUrl = proofFile ? await uploadOne("proof-docs", proofFile) : null;
      const receiptUrls: string[] = [];
      for (const r of receiptFiles) {
        const u = await uploadOne("proof-docs", r);
        if (u) receiptUrls.push(u);
      }

      const insert = {
        team_id: team.id, created_by: user.id, sku, brand: f.brand, model: f.model || null,
        source: f.source, date_acquired: f.date_acquired,
        storage_unit: f.storage_unit || null, condition: f.condition || null, defects: f.defects || null,
        status: f.status,
        list_price: f.list_price ? num(f.list_price) : null,
        date_listed: f.date_listed || null,
        sold_price: f.sold_price ? num(f.sold_price) : null,
        date_sold: f.date_sold || null,
        notes: [f.listing_url && `Marketplace listing: ${f.listing_url}`, f.notes].filter(Boolean).join("\n\n") || null,
        purchase_price: num(f.purchase_price),
        helper_cost: num(f.helper_cost),
        refurb_cost: num(f.refurb_cost),
        transport_cost: transportCostUsed,
        work_done: f.work_done || null,
        trip_start: f.trip_start || null, trip_end: f.trip_end || null,
        trip_km: f.trip_km ? num(f.trip_km) : null,
        trip_estimated_km: f.trip_estimated_km ? num(f.trip_estimated_km) : null,
        trip_round_trip: f.trip_round_trip,
        proof_purchase_url: proofUrl,
        receipt_urls: receiptUrls.length ? receiptUrls : null,
      };
      const { data: chair, error } = await supabase.from("chairs").insert(insert).select().single();
      if (error) throw error;

      // Auto-log trip
      if (f.trip_km && f.trip_start && f.trip_end) {
        await supabase.from("trips").insert({
          team_id: team.id, created_by: user.id, trip_date: f.date_acquired,
          start_location: f.trip_start, end_location: f.trip_end,
          km: num(f.trip_km),
          estimated_km: f.trip_estimated_km ? num(f.trip_estimated_km) : null,
          round_trip: f.trip_round_trip,
          purpose: `Pickup ${sku} (${f.brand})`, chair_id: chair.id,
        });
      }

      toast.success(`Saved ${sku}`);
      // Email send (best effort — requires Lovable Emails domain setup)
      fetch("/api/public/chair-saved-email", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ chairId: chair.id }),
      }).catch(() => {});
      nav({ to: "/app/inventory" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  const sections = [
    { id: "details" as const, label: "Details" },
    { id: "costs" as const, label: "Work & Costs" },
    { id: "trip" as const, label: "Transport" },
    { id: "proof" as const, label: "Proof" },
  ];

  return (
    <div className="pb-24">
      <div className="sticky top-14 z-20 bg-background/90 backdrop-blur border-b border-border">
        <div className="px-4 h-12 flex items-center justify-between">
          <button onClick={() => nav({ to: "/app/inventory" })} className="flex items-center text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> Back</button>
          <h1 className="text-base font-semibold">New Chair</h1>
          <Button size="sm" onClick={save} disabled={busy}><Save className="h-4 w-4 mr-1" />{busy ? "…" : "Save"}</Button>
        </div>
        <div className="flex gap-1 px-4 pb-2 overflow-x-auto no-scrollbar">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)} className={"shrink-0 rounded-full px-3 py-1 text-xs font-medium " + (section === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {section === "details" && (
          <>
            <Field label="Brand *"><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="Herman Miller" /></Field>
            <Field label="Model"><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="Aeron" /></Field>
            <Field label="Source">
              <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v as typeof f.source })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Marketplace Listing URL"><Input type="url" value={f.listing_url} onChange={(e) => setF({ ...f, listing_url: e.target.value })} placeholder="https://facebook.com/marketplace/item/…" /></Field>
            <Field label="Date acquired"><Input type="date" value={f.date_acquired} onChange={(e) => setF({ ...f, date_acquired: e.target.value })} /></Field>
            <Field label="Storage unit">
              <Select value={f.storage_unit} onValueChange={(v) => setF({ ...f, storage_unit: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Condition"><Input value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} /></Field>
            <Field label="Defects"><Textarea value={f.defects} onChange={(e) => setF({ ...f, defects: e.target.value })} rows={2} /></Field>
            <Field label="Status">
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as typeof f.status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="listed">Listed</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="List price"><Input type="number" step="0.01" value={f.list_price} onChange={(e) => setF({ ...f, list_price: e.target.value })} /></Field>
              <Field label="Date listed"><Input type="date" value={f.date_listed} onChange={(e) => setF({ ...f, date_listed: e.target.value })} /></Field>
              <Field label="Sold price"><Input type="number" step="0.01" value={f.sold_price} onChange={(e) => setF({ ...f, sold_price: e.target.value })} /></Field>
              <Field label="Date sold"><Input type="date" value={f.date_sold} onChange={(e) => setF({ ...f, date_sold: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} /></Field>
          </>
        )}

        {section === "costs" && (
          <>
            <Field label="Purchase price *"><Input type="number" step="0.01" value={f.purchase_price} onChange={(e) => setF({ ...f, purchase_price: e.target.value })} /></Field>
            <Field label="Helper cost"><Input type="number" step="0.01" value={f.helper_cost} onChange={(e) => setF({ ...f, helper_cost: e.target.value })} /></Field>
            <Field label="Refurb cost"><Input type="number" step="0.01" value={f.refurb_cost} onChange={(e) => setF({ ...f, refurb_cost: e.target.value })} /></Field>
            <Field label="Transport cost (auto from mileage if blank)"><Input type="number" step="0.01" value={f.transport_cost} onChange={(e) => setF({ ...f, transport_cost: e.target.value })} placeholder={autoTransport ? cad(autoTransport) : "0.00"} /></Field>
            <Field label="Work done"><Textarea rows={3} value={f.work_done} onChange={(e) => setF({ ...f, work_done: e.target.value })} /></Field>

            <div className="rounded-xl bg-muted/60 p-3 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Landed cost breakdown</p>
              <Row k="Purchase" v={cad(num(f.purchase_price))} />
              <Row k="Helper" v={cad(num(f.helper_cost))} />
              <Row k="Refurb" v={cad(num(f.refurb_cost))} />
              <Row k="Transport" v={cad(transportCostUsed)} />
              <div className="border-t border-border my-2" />
              <Row k="Total landed" v={cad(lc)} bold />
              {f.list_price && <Row k="Projected profit" v={cad(projectedProfit)} bold tone={projectedProfit >= 0 ? "success" : "destructive"} />}
            </div>
          </>
        )}

        {section === "trip" && (() => {
          const est = num(f.trip_estimated_km);
          const actual = num(f.trip_km);
          const v = est && actual ? variancePct(actual, est) : 0;
          const flagged = est && actual && Math.abs(v) > VARIANCE_FLAG_PCT;
          async function autoEstimate() {
            if (!f.trip_start || !f.trip_end) { toast.error("Enter both start and end"); return; }
            setEstimating(true);
            try {
              const { km } = await estimateDrivingKm(f.trip_start, f.trip_end);
              const rounded = Math.round(km * 10) / 10;
              setF((p) => ({ ...p, trip_estimated_km: String(rounded), trip_km: p.trip_km || String(rounded) }));
              toast.success(`OSRM: ${rounded} km one-way`);
            } catch (e) { toast.error((e as Error).message); }
            finally { setEstimating(false); }
          }
          return (
            <>
              <Field label="Start address"><Input value={f.trip_start} onChange={(e) => setF({ ...f, trip_start: e.target.value, trip_estimated_km: "" })} placeholder="123 Main St, Toronto, ON" /></Field>
              <Field label="End address"><Input value={f.trip_end} onChange={(e) => setF({ ...f, trip_end: e.target.value, trip_estimated_km: "" })} placeholder="456 King St, Hamilton, ON" /></Field>
              <Button type="button" variant="secondary" className="w-full" onClick={autoEstimate} disabled={estimating || !f.trip_start || !f.trip_end}>
                <MapPin className="h-4 w-4 mr-1.5" />{estimating ? "Calculating route…" : "Auto-calculate driving distance"}
              </Button>
              {est > 0 && (
                <div className="rounded-xl bg-card border border-border p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">OSM driving distance</span><span className="font-semibold tabular-nums">{est} km</span></div>
                </div>
              )}
              <Field label="Actual km driven (one way)"><Input type="number" step="0.1" value={f.trip_km} onChange={(e) => setF({ ...f, trip_km: e.target.value })} placeholder="From odometer" /></Field>
              <div className="flex items-center justify-between rounded-xl bg-card border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Round trip</p>
                  <p className="text-xs text-muted-foreground">Doubles the km logged</p>
                </div>
                <Switch checked={f.trip_round_trip} onCheckedChange={(v2) => setF({ ...f, trip_round_trip: v2 })} />
              </div>
              {flagged && (
                <div className="rounded-xl border border-[oklch(0.6_0.15_60)] bg-[oklch(0.97_0.04_85)] p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-[oklch(0.55_0.15_60)] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-[oklch(0.45_0.15_60)]">Variance {v > 0 ? "+" : ""}{v.toFixed(1)}%</p>
                    <p className="text-muted-foreground mt-0.5">Actual differs from OSM route by &gt;{VARIANCE_FLAG_PCT}%. Add a note (detour, stop, alternate route) for clean CRA records.</p>
                  </div>
                </div>
              )}
              {f.trip_km && (
                <div className="rounded-xl bg-muted/60 p-3 text-sm space-y-1">
                  <Row k="Total km logged" v={`${tripKmTotal(num(f.trip_km), f.trip_round_trip)} km`} />
                  <Row k="CRA per-km estimate (@ $0.70)" v={cad(tripDeduction(num(f.trip_km), f.trip_round_trip))} bold tone="success" />
                  <p className="text-xs text-muted-foreground pt-1">Logs to Vehicle Logbook on save. Actual deduction in dashboard uses your vehicle expenses × business-use %.</p>
                </div>
              )}
            </>
          );
        })()}

        {section === "proof" && (
          <>
            <Field label="Proof of purchase (FB Marketplace screenshot)">
              <Input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
              {proofFile && <p className="text-xs text-muted-foreground mt-1">{proofFile.name}</p>}
            </Field>
            <Field label="Repair receipts (multiple)">
              <Input type="file" accept="image/*" multiple onChange={(e) => setReceiptFiles(Array.from(e.target.files ?? []))} />
              {receiptFiles.length > 0 && <p className="text-xs text-muted-foreground mt-1">{receiptFiles.length} file(s)</p>}
            </Field>
            <p className="text-xs text-muted-foreground">Files are stored privately. A summary email with chair details is sent to your notification email when saved.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
      {children}
    </div>
  );
}
function Row({ k, v, bold, tone }: { k: string; v: string; bold?: boolean; tone?: "success" | "destructive" }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={(bold ? "font-semibold " : "") + (tone === "success" ? "text-[oklch(0.4_0.14_152)]" : tone === "destructive" ? "text-destructive" : "")}>{v}</span>
    </div>
  );
}

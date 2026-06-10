import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SuggestInput } from "@/components/SuggestInput";
import { toTitleCase } from "@/lib/text-case";
import { ChevronLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/app/chair/$chairId/edit")({ component: EditChair });

const SOURCES = [
  { v: "fb_marketplace", l: "Facebook Marketplace" },
  { v: "kijiji", l: "Kijiji" },
  { v: "estate_sale", l: "Estate Sale / Garage Sale" },
  { v: "supplier", l: "Supplier / Wholesale" },
  { v: "other", l: "Other" },
] as const;

function EditChair() {
  const { chairId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { team } = useTeam();
  const [busy, setBusy] = useState(false);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);

  const { data: chair, isLoading } = useQuery({
    queryKey: ["chair", chairId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chairs").select("*").eq("id", chairId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [f, setF] = useState<any>(null);

  useEffect(() => {
    if (chair && !f) {
      setF({
        brand: chair.brand ?? "",
        model: chair.model ?? "",
        source: chair.source ?? "fb_marketplace",
        date_acquired: chair.date_acquired ?? "",
        storage_unit: chair.storage_unit ?? "",
        condition: chair.condition ?? "",
        defects: chair.defects ?? "",
        status: chair.status ?? "in_stock",
        list_price: chair.list_price?.toString() ?? "",
        date_listed: chair.date_listed ?? "",
        sold_price: chair.sold_price?.toString() ?? "",
        date_sold: chair.date_sold ?? "",
        notes: chair.notes ?? "",
        purchase_price: chair.purchase_price?.toString() ?? "",
        helper_cost: chair.helper_cost?.toString() ?? "",
        refurb_cost: chair.refurb_cost?.toString() ?? "",
        transport_cost: chair.transport_cost?.toString() ?? "",
        work_done: chair.work_done ?? "",
        listed_platform: chair.listed_platform ?? "",
        buyer_name: chair.buyer_name ?? "",
        buyer_contact: chair.buyer_contact ?? "",
        payment_method: chair.payment_method ?? "",
        sale_notes: chair.sale_notes ?? "",
      });
    }
  }, [chair, f]);

  useEffect(() => {
    if (!team) return;
    supabase.from("storage_units").select("*").eq("team_id", team.id).then(({ data }) => setUnits(data ?? []));
  }, [team]);

  const [existing, setExisting] = useState<{ brand: string | null; model: string | null }[]>([]);
  useEffect(() => {
    if (!team) return;
    supabase.from("chairs").select("brand,model").eq("team_id", team.id).then(({ data }) => setExisting(data ?? []));
  }, [team]);

  const brandOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of existing) {
      const t = toTitleCase(r.brand ?? "");
      if (t) m.set(t.toLowerCase(), t);
    }
    return Array.from(m.values()).sort();
  }, [existing]);

  const modelOptions = useMemo(() => {
    const target = toTitleCase(f?.brand ?? "").toLowerCase();
    if (!target) return [];
    const m = new Map<string, string>();
    for (const r of existing) {
      if (toTitleCase(r.brand ?? "").toLowerCase() !== target) continue;
      const t = toTitleCase(r.model ?? "");
      if (t) m.set(t.toLowerCase(), t);
    }
    return Array.from(m.values()).sort();
  }, [existing, f?.brand]);

  if (isLoading || !f || !chair) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  const num = (s: string) => (s === "" ? null : Number(s));

  async function save() {
    if (!f.brand) return toast.error("Brand is required");
    setBusy(true);
    const updates = {
      brand: toTitleCase(f.brand),
      model: toTitleCase(f.model) || null,
      source: f.source,
      date_acquired: f.date_acquired,
      storage_unit: f.storage_unit || null,
      condition: f.condition || null,
      defects: f.defects || null,
      status: f.status,
      list_price: num(f.list_price),
      date_listed: f.date_listed || null,
      sold_price: num(f.sold_price),
      date_sold: f.date_sold || null,
      notes: f.notes || null,
      purchase_price: num(f.purchase_price) ?? 0,
      helper_cost: num(f.helper_cost) ?? 0,
      refurb_cost: num(f.refurb_cost) ?? 0,
      transport_cost: num(f.transport_cost) ?? 0,
      work_done: f.work_done || null,
      listed_platform: f.listed_platform || null,
      buyer_name: f.buyer_name || null,
      buyer_contact: f.buyer_contact || null,
      payment_method: f.payment_method || null,
      sale_notes: f.sale_notes || null,
    };
    const { error } = await supabase.from("chairs").update(updates).eq("id", chairId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["chair", chairId] });
    qc.invalidateQueries({ queryKey: ["chairs"] });
    nav({ to: "/app/inventory/$chairId", params: { chairId } });
  }

  return (
    <div className="pb-24">
      <div className="sticky top-14 z-20 bg-background/90 backdrop-blur border-b border-border">
        <div className="px-4 h-12 flex items-center justify-between">
          <button onClick={() => nav({ to: "/app/inventory/$chairId", params: { chairId } })} className="flex items-center text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-base font-semibold truncate">Edit · {chair.sku}</h1>
          <Button size="sm" onClick={save} disabled={busy}>
            <Save className="h-4 w-4 mr-1" />{busy ? "…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <Field label="Brand *">
          <Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} />
        </Field>
        <Field label="Model">
          <Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} />
        </Field>
        <Field label="Source">
          <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date acquired">
          <Input type="date" value={f.date_acquired} onChange={(e) => setF({ ...f, date_acquired: e.target.value })} />
        </Field>
        <Field label="Storage unit">
          <Select value={f.storage_unit} onValueChange={(v) => setF({ ...f, storage_unit: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {units.map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Condition">
          <Input value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} />
        </Field>
        <Field label="Defects">
          <Textarea rows={2} value={f.defects} onChange={(e) => setF({ ...f, defects: e.target.value })} />
        </Field>
        <Field label="Work done">
          <Textarea rows={2} value={f.work_done} onChange={(e) => setF({ ...f, work_done: e.target.value })} />
        </Field>
        <Field label="Status">
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="listed">Listed</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase price">
            <Input type="number" step="0.01" value={f.purchase_price} onChange={(e) => setF({ ...f, purchase_price: e.target.value })} />
          </Field>
          <Field label="Helper cost">
            <Input type="number" step="0.01" value={f.helper_cost} onChange={(e) => setF({ ...f, helper_cost: e.target.value })} />
          </Field>
          <Field label="Refurb cost">
            <Input type="number" step="0.01" value={f.refurb_cost} onChange={(e) => setF({ ...f, refurb_cost: e.target.value })} />
          </Field>
          <Field label="Transport cost">
            <Input type="number" step="0.01" value={f.transport_cost} onChange={(e) => setF({ ...f, transport_cost: e.target.value })} />
          </Field>
          <Field label="List price">
            <Input type="number" step="0.01" value={f.list_price} onChange={(e) => setF({ ...f, list_price: e.target.value })} />
          </Field>
          <Field label="Date listed">
            <Input type="date" value={f.date_listed} onChange={(e) => setF({ ...f, date_listed: e.target.value })} />
          </Field>
          <Field label="Sold price">
            <Input type="number" step="0.01" value={f.sold_price} onChange={(e) => setF({ ...f, sold_price: e.target.value })} />
          </Field>
          <Field label="Date sold">
            <Input type="date" value={f.date_sold} onChange={(e) => setF({ ...f, date_sold: e.target.value })} />
          </Field>
        </div>

        <Field label="Listed platform">
          <Input value={f.listed_platform} onChange={(e) => setF({ ...f, listed_platform: e.target.value })} placeholder="Facebook Marketplace, Kijiji…" />
        </Field>
        <Field label="Buyer name">
          <Input value={f.buyer_name} onChange={(e) => setF({ ...f, buyer_name: e.target.value })} />
        </Field>
        <Field label="Buyer contact">
          <Input value={f.buyer_contact} onChange={(e) => setF({ ...f, buyer_contact: e.target.value })} />
        </Field>
        <Field label="Payment method">
          <Input value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })} />
        </Field>
        <Field label="Sale notes">
          <Textarea rows={2} value={f.sale_notes} onChange={(e) => setF({ ...f, sale_notes: e.target.value })} />
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { cad, daysBetween, landedCost, profit, STALE_DAYS } from "@/lib/cra";
import { ChevronLeft, Trash2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePermission, PERMISSIONS } from "@/hooks/use-permission";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";

const SOURCE_LABELS: Record<string, string> = {
  fb_marketplace: "Facebook Marketplace", kijiji: "Kijiji",
  estate_sale: "Estate Sale / Garage Sale", supplier: "Supplier / Wholesale", other: "Other (eBay, etc.)",
};

const PAYMENT_METHODS = [
  { v: "cash", l: "Cash" },
  { v: "etransfer", l: "E-Transfer" },
  { v: "paypal", l: "PayPal" },
  { v: "credit", l: "Credit Card" },
  { v: "cheque", l: "Cheque" },
  { v: "other", l: "Other" },
];

const PAYMENT_LABELS: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.v, p.l]));

export const Route = createFileRoute("/app/inventory/$chairId")({ component: ChairDetail });

function ChairDetail() {
  const { chairId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const canDelete = usePermission(PERMISSIONS.CHAIR_DELETE);
  const canEdit = usePermission(PERMISSIONS.CHAIR_EDIT);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [sellBusy, setSellBusy] = useState(false);
  const [sellForm, setSellForm] = useState({
    sold_price: "", payment_method: "etransfer", buyer_name: "", buyer_contact: "",
    date_sold: new Date().toISOString().slice(0, 10), sale_notes: "",
  });

  const { data: chair, isLoading } = useQuery({
    queryKey: ["chair", chairId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chairs").select("*").eq("id", chairId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!chair) return <p className="p-6 text-sm">Not found.</p>;

  const days = chair.status === "sold" && chair.date_sold ? daysBetween(chair.date_acquired, chair.date_sold) : daysBetween(chair.date_acquired);
  const stale = chair.status !== "sold" && days > STALE_DAYS;
  const lc = landedCost(chair);
  const p = profit(chair);
  const isSold = chair.status === "sold";

  async function doDelete() {
    const { error } = await supabase.from("chairs").delete().eq("id", chairId);
    if (error) { toast.error(error.message); return; }
    toast.success("Chair deleted");
    qc.invalidateQueries({ queryKey: ["chairs"] });
    nav({ to: "/app/inventory" });
  }

  async function buildDownloads(c: any): Promise<{ url: string; label: string }[]> {
    const out: { url: string; label: string }[] = [];
    const sku = c.sku || "chair";
    // Proof of purchase (private bucket → signed URL)
    if (c.proof_purchase_url) {
      try {
        const path = c.proof_purchase_url.split("/proof-docs/")[1];
        if (path) {
          const { data } = await supabase.storage.from("proof-docs").createSignedUrl(path, 60 * 60 * 24 * 7);
          if (data?.signedUrl) {
            const ext = path.split(".").pop() || "jpg";
            out.push({ url: data.signedUrl, label: `proof-${sku}.${ext}` });
          }
        } else {
          out.push({ url: c.proof_purchase_url, label: `proof-${sku}` });
        }
      } catch { /* ignore */ }
    }
    // Receipts (public bucket)
    const receipts: string[] = Array.isArray(c.receipt_urls) ? c.receipt_urls : [];
    receipts.forEach((url, i) => {
      const ext = (url.split("?")[0].split(".").pop() || "jpg").slice(0, 4);
      out.push({ url, label: `receipt-${i + 1}-${sku}.${ext}` });
    });
    return out;
  }

  async function sendSaleEmail(updated: any) {
    const { data: profileRow } = await supabase
      .from("profiles").select("notification_email,email,full_name")
      .eq("id", updated.created_by).maybeSingle();
    const recipient = profileRow?.notification_email || profileRow?.email;
    if (!recipient) return;
    const lcCalc = landedCost(updated);
    const profitCalc = Number(updated.sold_price ?? 0) - lcCalc;
    const daysHeld = updated.date_sold ? daysBetween(updated.date_acquired, updated.date_sold) : null;
    const downloads = await buildDownloads(updated);
    await sendTransactionalEmail({
      templateName: "chair-sale",
      recipientEmail: recipient,
      idempotencyKey: `chair-sale-${updated.id}-${updated.date_sold}`,
      templateData: {
        sku: updated.sku, brand: updated.brand, model: updated.model || "",
        soldBy: profileRow?.full_name || profileRow?.email || "Team",
        soldAt: new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" }),
        dateSold: updated.date_sold,
        buyerName: updated.buyer_name || "",
        buyerContact: updated.buyer_contact || "",
        paymentMethod: updated.payment_method || "other",
        soldPrice: Number(updated.sold_price ?? 0),
        landedCost: lcCalc,
        profit: profitCalc,
        daysHeld,
        saleNotes: updated.sale_notes || "",
        source: SOURCE_LABELS[updated.source] ?? updated.source ?? "",
        dateAcquired: updated.date_acquired || "",
        purchasePrice: Number(updated.purchase_price ?? 0),
        transportCost: Number(updated.transport_cost ?? 0),
        refurbCost: Number(updated.refurb_cost ?? 0),
        helperCost: Number(updated.helper_cost ?? 0),
        condition: updated.condition || "",
        defects: updated.defects || "",
        workDone: updated.work_done || "",
        downloads,
      },
    });
  }

  async function doSell() {
    const price = parseFloat(sellForm.sold_price);
    if (!price || price <= 0) return toast.error("Enter a valid sold price");
    setSellBusy(true);
    const updates = {
      status: "sold" as const,
      sold_price: price,
      date_sold: sellForm.date_sold,
      payment_method: sellForm.payment_method,
      buyer_name: sellForm.buyer_name || null,
      buyer_contact: sellForm.buyer_contact || null,
      sale_notes: sellForm.sale_notes || null,
    };
    const { data: updated, error } = await supabase.from("chairs").update(updates).eq("id", chairId).select().maybeSingle();
    if (error) { setSellBusy(false); return toast.error(error.message); }
    const profitNum = updated ? Number(updated.sold_price ?? 0) - landedCost(updated) : 0;
    toast.success(`Sale confirmed — ${cad(profitNum)} profit on this flip 🎉`);
    qc.invalidateQueries({ queryKey: ["chair", chairId] });
    qc.invalidateQueries({ queryKey: ["chairs"] });
    if (updated) {
      try { await sendSaleEmail(updated); } catch (e: any) { toast.error("Email failed: " + (e?.message ?? "unknown")); }
    }
    setSellBusy(false);
    setSellOpen(false);
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <button onClick={() => nav({ to: "/app/inventory" })} className="flex items-center text-sm text-muted-foreground mb-3"><ChevronLeft className="h-4 w-4" /> My Stock</button>
      <p className="text-xs font-mono text-muted-foreground tracking-wider">{chair.sku}</p>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="text-2xl font-bold">{chair.brand}{chair.model ? ` · ${chair.model}` : ""}</h1>
        <StatusBadge status={chair.status} stale={stale} />
      </div>
      <p className="text-sm text-muted-foreground mt-1">{chair.condition ?? "—"} · {chair.storage_unit ?? "—"} · {days} days held</p>

      {!isSold && canEdit && (
        <div className="mt-4">
          <Button onClick={() => setSellOpen(true)} className="w-full h-12 bg-[oklch(0.55_0.16_152)] hover:bg-[oklch(0.5_0.16_152)] text-white">
            <DollarSign className="h-5 w-5 mr-1.5" /> Mark as Sold
          </Button>
        </div>
      )}

      <Section title="Flip Summary">
        <KV k="Bought from" v={SOURCE_LABELS[chair.source] ?? chair.source} />
        <KV k="Days in storage" v={`${days} days`} />
        <KV k={isSold ? "Profit made" : "Projected profit"} v={cad(p)} bold tone={p >= 0 ? "success" : "destructive"} />
        <KV k="Profit / day held" v={days > 0 ? cad(p / days) : "—"} />
      </Section>

      {isSold && (
        <Section title="Sale">
          <KV k="Sold price" v={cad(chair.sold_price)} bold tone="success" />
          <KV k="Date sold" v={chair.date_sold ?? "—"} />
          <KV k="Payment" v={chair.payment_method ? (PAYMENT_LABELS[chair.payment_method] ?? chair.payment_method) : "—"} />
          {chair.buyer_name && <KV k="Buyer" v={chair.buyer_name} />}
          {chair.buyer_contact && <KV k="Buyer contact" v={chair.buyer_contact} />}
          {chair.sale_notes && <Note label="Sale notes" text={chair.sale_notes} />}
        </Section>
      )}

      <Section title="Financials">
        <KV k="Purchase" v={cad(chair.purchase_price)} />
        <KV k="Helper" v={cad(chair.helper_cost)} />
        <KV k="Refurb" v={cad(chair.refurb_cost)} />
        <KV k="Transport" v={cad(chair.transport_cost)} />
        <KV k="Landed cost" v={cad(lc)} bold />
        <KV k="List price" v={chair.list_price ? cad(chair.list_price) : "—"} />
        <KV k="Sold price" v={chair.sold_price ? cad(chair.sold_price) : "—"} />
        <KV k={isSold ? "Profit" : "Projected profit"} v={cad(p)} bold tone={p >= 0 ? "success" : "destructive"} />
      </Section>

      {(chair.trip_km || chair.trip_start) && (
        <Section title="Pickup trip">
          <KV k="Route" v={`${chair.trip_start ?? "—"} → ${chair.trip_end ?? "—"}`} />
          <KV k="Km" v={`${Number(chair.trip_km) * (chair.trip_round_trip ? 2 : 1)} km`} />
        </Section>
      )}

      {(chair.defects || chair.work_done || chair.notes) && (
        <Section title="Notes">
          {chair.defects && <Note label="Defects" text={chair.defects} />}
          {chair.work_done && <Note label="Work done" text={chair.work_done} />}
          {chair.notes && <Note label="Notes" text={chair.notes} />}
        </Section>
      )}

      <Section title="Dates">
        <KV k="Acquired" v={chair.date_acquired} />
        {chair.date_listed && <KV k="Listed" v={chair.date_listed} />}
        {chair.date_sold && <KV k="Sold" v={chair.date_sold} />}
      </Section>

      {canDelete && (
        <div className="mt-6">
          <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete chair
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${chair.brand}${chair.model ? " · " + chair.model : ""}?`}
        description="This permanently removes the chair and all its data. This cannot be undone."
        onConfirm={doDelete}
      />

      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as sold</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp">Sold price (CAD) *</Label>
              <Input id="sp" type="number" inputMode="decimal" step="0.01" placeholder="650.00"
                value={sellForm.sold_price} onChange={(e) => setSellForm({ ...sellForm, sold_price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm">Payment method *</Label>
              <Select value={sellForm.payment_method} onValueChange={(v) => setSellForm({ ...sellForm, payment_method: v })}>
                <SelectTrigger id="pm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ds">Date sold</Label>
                <Input id="ds" type="date" value={sellForm.date_sold} onChange={(e) => setSellForm({ ...sellForm, date_sold: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bn">Buyer name</Label>
                <Input id="bn" placeholder="Optional" value={sellForm.buyer_name} onChange={(e) => setSellForm({ ...sellForm, buyer_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bc">Buyer contact</Label>
              <Input id="bc" placeholder="Phone or FB profile (optional)"
                value={sellForm.buyer_contact} onChange={(e) => setSellForm({ ...sellForm, buyer_contact: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sn">Sale notes</Label>
              <Textarea id="sn" rows={3} placeholder="e.g. buyer picked up, no issues"
                value={sellForm.sale_notes} onChange={(e) => setSellForm({ ...sellForm, sale_notes: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">A proof-of-sale email will be sent to your notification email.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellOpen(false)} disabled={sellBusy}>Cancel</Button>
            <Button onClick={doSell} disabled={sellBusy} className="bg-[oklch(0.55_0.16_152)] hover:bg-[oklch(0.5_0.16_152)] text-white">
              {sellBusy ? "Saving…" : "Confirm sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h2>
      <div className="rounded-2xl bg-card border border-border divide-y divide-border">{children}</div>
    </div>
  );
}
function KV({ k, v, bold, tone }: { k: string; v: string; bold?: boolean; tone?: "success" | "destructive" }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={"tabular-nums " + (bold ? "font-semibold " : "") + (tone === "success" ? "text-[oklch(0.4_0.14_152)]" : tone === "destructive" ? "text-destructive" : "")}>{v}</span>
    </div>
  );
}
function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="px-4 py-2.5 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}

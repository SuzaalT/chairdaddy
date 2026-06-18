import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { useAuth } from "@/hooks/use-auth";
import { Stat } from "@/components/Stat";
import { cad } from "@/lib/cra";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Camera, Loader2, Plus, Receipt, Sparkles, Pencil, Trash2, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { callAnthropic, fileToBase64 } from "@/lib/anthropic";
import { useMultiSelect, useLongPress } from "@/hooks/use-multi-select";
import { SelectionBar } from "@/components/SelectionBar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/expenses")({ component: Expenses });

const CATS = [
  { v: "vehicle_fuel", l: "Vehicle / Fuel" }, { v: "helper_wages", l: "Helper Wages" },
  { v: "refurb_supplies", l: "Refurb Supplies" }, { v: "cleaning_supplies", l: "Cleaning Supplies" },
  { v: "tools_equipment", l: "Tools & Equipment" }, { v: "storage_rent", l: "Storage / Rent" },
  { v: "phone_internet", l: "Phone & Internet" }, { v: "insurance", l: "Insurance" },
  { v: "bank_fees", l: "Bank Fees" }, { v: "other", l: "Other" },
] as const;

type FormState = { amount: string; expense_date: string; category: string; vendor: string; notes: string; receipt_url: string };

const emptyForm = (): FormState => ({ amount: "", expense_date: new Date().toISOString().slice(0, 10), category: "other", vendor: "", notes: "", receipt_url: "" });

function Expenses() {
  const { team, profile } = useTeam();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [f, setF] = useState<FormState>(emptyForm());
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const sel = useMultiSelect();
  const [pendingBulk, setPendingBulk] = useState(false);

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", team?.id],
    enabled: !!team,
    queryFn: async () => (await supabase.from("expenses").select("*").eq("team_id", team!.id).order("expense_date", { ascending: false })).data ?? [],
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const thisMonth = expenses.filter((e) => new Date(e.expense_date) >= monthStart).reduce((s, e) => s + Number(e.amount), 0);
  const last12 = expenses.filter((e) => new Date(e.expense_date) >= yearAgo).reduce((s, e) => s + Number(e.amount), 0);

  async function scanReceipt(file: File) {
    if (!profile?.anthropic_key) { toast.error("Add your Anthropic key in Settings first"); return; }
    setScanning(true);
    try {
      const path = `${team!.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);
      const { data, mediaType } = await fileToBase64(file);
      const text = await callAnthropic({
        apiKey: profile.anthropic_key,
        system: "You extract receipt info. Reply ONLY as compact JSON: {\"amount\": number, \"date\": \"YYYY-MM-DD\", \"vendor\": string, \"category\": one of vehicle_fuel|helper_wages|refurb_supplies|cleaning_supplies|tools_equipment|storage_rent|phone_internet|insurance|bank_fees|other}",
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text: "Extract receipt info as JSON." },
        ] }],
      });
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]);
        setF((p) => ({
          ...p,
          amount: String(j.amount ?? p.amount),
          expense_date: j.date ?? p.expense_date,
          vendor: j.vendor ?? p.vendor,
          category: j.category ?? p.category,
          receipt_url: pub.publicUrl,
        }));
        toast.success("Receipt scanned");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setScanning(false); }
  }

  function startEdit(e: typeof expenses[number]) {
    setEditingId(e.id);
    setOpen(true);
    setF({
      amount: String(e.amount ?? ""),
      expense_date: e.expense_date,
      category: e.category,
      vendor: e.vendor ?? "",
      notes: e.notes ?? "",
      receipt_url: e.receipt_url ?? "",
    });
  }

  function cancelForm() {
    setOpen(false);
    setEditingId(null);
    setF(emptyForm());
  }

  async function save() {
    if (!team || !user || !f.amount) return;
    const payload = {
      amount: Number(f.amount),
      expense_date: f.expense_date,
      category: f.category as "other",
      vendor: f.vendor || null,
      notes: f.notes || null,
      receipt_url: f.receipt_url || null,
    };
    if (editingId) {
      const { error } = await supabase.from("expenses").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
      toast.success("Expense updated");
    } else {
      const { error } = await supabase.from("expenses").insert({ ...payload, team_id: team.id, created_by: user.id });
      if (error) return toast.error(error.message);
      toast.success("Expense added");
    }
    cancelForm();
    qc.invalidateQueries({ queryKey: ["expenses", team.id] });
  }

  async function doDelete() {
    if (!pendingDelete) return;
    const { error } = await supabase.from("expenses").delete().eq("id", pendingDelete.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["expenses", team?.id] }); }
    setPendingDelete(null);
  }

  async function doBulkDelete() {
    const ids = Array.from(sel.selected);
    if (!ids.length) return;
    const { error } = await supabase.from("expenses").delete().in("id", ids);
    setPendingBulk(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} item${ids.length === 1 ? "" : "s"} deleted`);
    sel.exit();
    qc.invalidateQueries({ queryKey: ["expenses", team?.id] });
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
        {sel.active ? (
          <button onClick={sel.exit} className="text-sm font-medium text-muted-foreground">Cancel</button>
        ) : (
          expenses.length > 0 && (
            <button
              onClick={() => sel.enter()}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <CheckSquare className="h-4 w-4" /> Select
            </button>
          )
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat label="This Month" value={cad(thisMonth)} icon={Receipt} />
        <Stat label="Last 12 Months" value={cad(last12)} icon={Receipt} />
      </div>

      {!open ? (
        <Button onClick={() => { setEditingId(null); setF(emptyForm()); setOpen(true); }} className="w-full h-12 mb-4"><Plus className="h-4 w-4 mr-1.5" /> Add expense</Button>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Edit expense" : "New expense"}</h2>
            <button onClick={cancelForm} className="text-xs text-muted-foreground">Cancel</button>
          </div>
          {!editingId && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Scan receipt</Label>
              <label className="mt-1 flex items-center justify-center gap-2 h-20 rounded-xl border border-dashed border-border bg-muted/40 cursor-pointer">
                {scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Camera className="h-5 w-5" /><span className="text-sm">Take photo or upload</span></>}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && scanReceipt(e.target.files[0])} />
              </label>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI auto-fills amount, date, vendor, category</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Amount</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Paid To</Label><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></div>
          <Button onClick={save} className="w-full">{editingId ? "Save changes" : "Save"}</Button>
        </div>
      )}

      <div className="space-y-2">
        {expenses.map((e) => {
          const cat = CATS.find((c) => c.v === e.category);
          return (
            <ExpenseRow
              key={e.id}
              id={e.id}
              title={e.vendor || cat?.l || "Expense"}
              subtitle={`${e.expense_date} · ${cat?.l ?? ""}`}
              amount={cad(e.amount)}
              selectionActive={sel.active}
              selected={sel.selected.has(e.id)}
              onLongPress={() => sel.enter(e.id)}
              onToggle={() => sel.toggle(e.id)}
              onEdit={() => startEdit(e)}
              onDelete={() => setPendingDelete({ id: e.id, label: e.vendor || cat?.l || "this expense" })}
            />
          );
        })}
        {expenses.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No expenses yet.</p>}
      </div>

      {sel.active && (
        <SelectionBar
          count={sel.selected.size}
          total={expenses.length}
          allSelected={sel.selected.size === expenses.length}
          onToggleAll={(on) => sel.setAll(expenses.map((e) => e.id), on)}
          onDelete={() => setPendingBulk(true)}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.label}?`}
        description="This permanently removes the expense. This cannot be undone."
        onConfirm={doDelete}
      />

      <ConfirmDialog
        open={pendingBulk}
        onOpenChange={setPendingBulk}
        title={`Delete ${sel.selected.size} item${sel.selected.size === 1 ? "" : "s"}?`}
        description="This cannot be undone."
        onConfirm={doBulkDelete}
      />
    </div>
  );
}

function ExpenseRow({
  id, title, subtitle, amount,
  selectionActive, selected, onLongPress, onToggle, onEdit, onDelete,
}: {
  id: string; title: string; subtitle: string; amount: string;
  selectionActive: boolean; selected: boolean;
  onLongPress: () => void; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const lp = useLongPress(onLongPress);
  return (
    <div
      {...lp.handlers}
      onClick={() => { if (selectionActive) onToggle(); }}
      className={cn(
        "flex items-center gap-3 rounded-xl bg-card border border-border p-3 transition-colors select-none",
        selectionActive && "cursor-pointer",
        selected && "bg-primary/5 border-primary/40",
      )}
    >
      {selectionActive && (
        <Checkbox checked={selected} onCheckedChange={onToggle} onClick={(e) => e.stopPropagation()} className="h-5 w-5 rounded-full" />
      )}
      <div className="h-10 w-10 rounded-full bg-accent text-accent-foreground grid place-items-center"><Receipt className="h-4 w-4" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <p className="text-sm font-semibold tabular-nums">{amount}</p>
      {!selectionActive && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} aria-label="Edit expense" className="h-8 w-8 grid place-items-center rounded-full border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} aria-label="Delete expense" className="h-8 w-8 grid place-items-center rounded-full border border-border bg-card hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

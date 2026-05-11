import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { useAuth } from "@/hooks/use-auth";
import { Stat } from "@/components/Stat";
import { cad, tripKmTotal } from "@/lib/cra";
import { estimateDrivingKm, variancePct, VARIANCE_FLAG_PCT } from "@/lib/distance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, Plus, Route as RouteIcon, Fuel, Gauge, MapPin, AlertTriangle, Wrench, Receipt, Percent } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/logbook")({ component: Logbook });

const FUEL_CATS = ["gas"] as const;
const EXPENSE_CATS = [
  { v: "insurance", l: "Insurance" },
  { v: "registration", l: "Registration / Plates" },
  { v: "parking", l: "Parking / Tolls" },
  { v: "lease", l: "Loan / Lease Payment" },
  { v: "other", l: "Other" },
] as const;
const MAINT_CATS = [
  { v: "oil_change", l: "Oil Change" },
  { v: "tires", l: "Tires" },
  { v: "repairs", l: "Repairs / Brakes / Mechanical" },
  { v: "car_wash", l: "Car Wash / Detail" },
] as const;

const FUEL_SET = new Set<string>(FUEL_CATS);
const MAINT_SET = new Set(MAINT_CATS.map((c) => c.v));

function Logbook() {
  const { team } = useTeam();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dashboard" | "trips" | "fuel" | "expenses" | "maint">("dashboard");

  const year = new Date().getFullYear();
  const ystart = `${year}-01-01`;

  const { data: trips = [] } = useQuery({
    queryKey: ["trips", team?.id],
    enabled: !!team,
    queryFn: async () => (await supabase.from("trips").select("*").eq("team_id", team!.id).order("trip_date", { ascending: false })).data ?? [],
  });
  const { data: vexp = [] } = useQuery({
    queryKey: ["vehicle_expenses", team?.id],
    enabled: !!team,
    queryFn: async () => (await supabase.from("vehicle_expenses").select("*").eq("team_id", team!.id).order("expense_date", { ascending: false })).data ?? [],
  });
  const { data: odo } = useQuery({
    queryKey: ["odometer", team?.id, year],
    enabled: !!team,
    queryFn: async () => (await supabase.from("odometer_readings").select("*").eq("team_id", team!.id).eq("year", year).maybeSingle()).data,
  });

  const yearTrips = trips.filter((t) => t.trip_date >= ystart);
  const businessTrips = yearTrips.filter((t) => !t.is_personal);
  const personalTrips = yearTrips.filter((t) => t.is_personal);
  const businessKm = businessTrips.reduce((s, t) => s + tripKmTotal(Number(t.km), t.round_trip), 0);
  const personalLoggedKm = personalTrips.reduce((s, t) => s + tripKmTotal(Number(t.km), t.round_trip), 0);
  const totalKm = odo?.start_km != null && odo?.end_km != null ? Math.max(0, Number(odo.end_km) - Number(odo.start_km)) : 0;
  const personalKm = totalKm > 0 ? Math.max(0, totalKm - businessKm) : personalLoggedKm;
  const businessPct = totalKm > 0 ? (businessKm / totalKm) * 100 : 0;

  const yearVexp = vexp.filter((e) => e.expense_date >= ystart);
  const fuelRows = yearVexp.filter((e) => FUEL_SET.has(e.category));
  const maintRows = yearVexp.filter((e) => MAINT_SET.has(e.category));
  const expRows = yearVexp.filter((e) => !FUEL_SET.has(e.category) && !MAINT_SET.has(e.category));
  const totalVehExp = yearVexp.reduce((s, e) => s + Number(e.amount), 0);
  const fuelTotal = fuelRows.reduce((s, e) => s + Number(e.amount), 0);
  const maintTotal = maintRows.reduce((s, e) => s + Number(e.amount), 0);
  const expTotal = expRows.reduce((s, e) => s + Number(e.amount), 0);
  const craDeduction = totalVehExp * (businessPct / 100);

  const tabs = [
    { id: "dashboard" as const, l: "Dashboard", i: Gauge },
    { id: "trips" as const, l: "Trips", i: RouteIcon },
    { id: "fuel" as const, l: "Fuel", i: Fuel },
    { id: "expenses" as const, l: "Expenses", i: Receipt },
    { id: "maint" as const, l: "Maintenance", i: Wrench },
  ];

  return (
    <div className="px-4 pt-4 pb-24">
      <h1 className="text-2xl font-bold tracking-tight mb-3">Vehicle Logbook</h1>
      <div className="flex gap-1 mb-4 overflow-x-auto no-scrollbar -mx-4 px-4">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={"shrink-0 rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 " + (tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            <t.i className="h-3.5 w-3.5" />{t.l}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total km (year)" value={`${Math.round(totalKm).toLocaleString()}`} icon={Car} hint={odo?.start_km != null && odo?.end_km != null ? "From odometer" : "Set odometer →"} />
            <Stat label="Business km" value={`${Math.round(businessKm).toLocaleString()}`} icon={RouteIcon} hint={`${businessTrips.length} trips`} />
            <Stat label="Personal km" value={`${Math.round(personalKm).toLocaleString()}`} icon={MapPin} hint={totalKm > 0 ? "Total − Business" : `${personalTrips.length} logged`} />
            <Stat label="Business use" value={`${businessPct.toFixed(1)}%`} icon={Percent} tone={businessPct > 0 ? "success" : "default"} />
          </div>

          <div className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">CRA Deduction (Actual Method)</p>
            <p className="mt-1.5 text-3xl font-semibold tabular-nums text-[oklch(0.55_0.16_152)]">{cad(craDeduction)}</p>
            <p className="text-xs text-muted-foreground mt-1">{cad(totalVehExp)} vehicle costs × {businessPct.toFixed(1)}% business use</p>
            {totalKm === 0 && <p className="text-xs text-[oklch(0.55_0.15_60)] mt-2">⚠ Enter odometer readings below to calculate business-use %.</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Fuel" value={cad(fuelTotal)} icon={Fuel} hint={`${fuelRows.length}`} />
            <Stat label="Expenses" value={cad(expTotal)} icon={Receipt} hint={`${expRows.length}`} />
            <Stat label="Maintenance" value={cad(maintTotal)} icon={Wrench} hint={`${maintRows.length}`} />
          </div>

          <OdometerCard row={odo} year={year} teamId={team?.id} userId={user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["odometer", team?.id, year] })} />
        </div>
      )}

      {tab === "trips" && <TripsPanel trips={trips} teamId={team?.id} userId={user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["trips", team?.id] })} />}

      {tab === "fuel" && <FuelPanel rows={fuelRows} allRows={vexp.filter((e) => FUEL_SET.has(e.category))} teamId={team?.id} userId={user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["vehicle_expenses", team?.id] })} />}

      {tab === "expenses" && <ExpensesPanel rows={vexp.filter((e) => !FUEL_SET.has(e.category) && !MAINT_SET.has(e.category))} teamId={team?.id} userId={user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["vehicle_expenses", team?.id] })} cats={EXPENSE_CATS} title="Vehicle Expense" />}

      {tab === "maint" && <ExpensesPanel rows={vexp.filter((e) => MAINT_SET.has(e.category))} teamId={team?.id} userId={user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["vehicle_expenses", team?.id] })} cats={MAINT_CATS} title="Maintenance" />}
    </div>
  );
}

/* ---------- Trips ---------- */

function TripsPanel({ trips, teamId, userId, onSaved }: { trips: any[]; teamId?: string; userId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "business" | "personal">("all");
  const [estimating, setEstimating] = useState(false);
  const blank = { trip_date: new Date().toISOString().slice(0, 10), start_location: "", end_location: "", km: "", estimated_km: "", round_trip: false, purpose: "", is_personal: false };
  const [f, setF] = useState(blank);

  async function autoEstimate() {
    if (!f.start_location || !f.end_location) return;
    setEstimating(true);
    try {
      const { km } = await estimateDrivingKm(f.start_location, f.end_location);
      const r = Math.round(km * 10) / 10;
      setF((p) => ({ ...p, estimated_km: String(r), km: p.km || String(r) }));
      toast.success(`OSM: ${r} km`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setEstimating(false); }
  }

  async function save() {
    if (!teamId || !userId || !f.km || !f.start_location || !f.end_location) return;
    const { error } = await supabase.from("trips").insert({
      team_id: teamId, created_by: userId, trip_date: f.trip_date,
      start_location: f.start_location, end_location: f.end_location,
      km: Number(f.km), estimated_km: f.estimated_km ? Number(f.estimated_km) : null,
      round_trip: f.round_trip, is_personal: f.is_personal,
      purpose: f.purpose || (f.is_personal ? "Personal" : null),
    });
    if (error) return toast.error(error.message);
    toast.success("Trip logged");
    setOpen(false);
    setF(blank);
    onSaved();
  }

  const est = Number(f.estimated_km || 0);
  const actual = Number(f.km || 0);
  const v = est && actual ? variancePct(actual, est) : 0;
  const flagged = est && actual && Math.abs(v) > VARIANCE_FLAG_PCT;
  const filtered = trips.filter((t) => filter === "all" ? true : filter === "personal" ? t.is_personal : !t.is_personal);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["all", "business", "personal"] as const).map((x) => (
          <button key={x} onClick={() => setFilter(x)} className={"flex-1 rounded-full px-3 py-1.5 text-xs font-medium capitalize " + (filter === x ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{x}</button>
        ))}
      </div>

      {!open ? (
        <Button onClick={() => setOpen(true)} className="w-full h-12"><Plus className="h-4 w-4 mr-1.5" />Log a trip</Button>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold">New trip</h2><button onClick={() => setOpen(false)} className="text-xs text-muted-foreground">Cancel</button></div>
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
            <Label className="text-sm">Personal trip</Label>
            <Switch checked={f.is_personal} onCheckedChange={(v2) => setF({ ...f, is_personal: v2 })} />
          </div>
          <div><Label className="text-xs">Date</Label><Input type="date" value={f.trip_date} onChange={(e) => setF({ ...f, trip_date: e.target.value })} /></div>
          <div><Label className="text-xs">Start address</Label><Input value={f.start_location} onChange={(e) => setF({ ...f, start_location: e.target.value, estimated_km: "" })} placeholder="123 Main St, Toronto" /></div>
          <div><Label className="text-xs">End address</Label><Input value={f.end_location} onChange={(e) => setF({ ...f, end_location: e.target.value, estimated_km: "" })} placeholder="456 King St, Hamilton" /></div>
          <Button type="button" variant="secondary" className="w-full" onClick={autoEstimate} disabled={estimating || !f.start_location || !f.end_location}>
            <MapPin className="h-4 w-4 mr-1.5" />{estimating ? "Calculating…" : "Auto-calculate driving distance"}
          </Button>
          {est > 0 && <div className="text-sm flex justify-between rounded-lg bg-muted/60 p-2"><span className="text-muted-foreground">OSM driving distance</span><span className="font-semibold">{est} km</span></div>}
          <div><Label className="text-xs">Actual km driven (one way)</Label><Input type="number" step="0.1" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} /></div>
          <div className="flex items-center justify-between"><Label className="text-sm">Round trip</Label><Switch checked={f.round_trip} onCheckedChange={(v2) => setF({ ...f, round_trip: v2 })} /></div>
          {!f.is_personal && <div><Label className="text-xs">Business purpose</Label><Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="Pickup chair, supplier visit…" /></div>}
          {flagged && (
            <div className="rounded-xl border border-[oklch(0.6_0.15_60)] bg-[oklch(0.97_0.04_85)] p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-[oklch(0.55_0.15_60)] shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-[oklch(0.45_0.15_60)]">Variance {v > 0 ? "+" : ""}{v.toFixed(1)}%</p>
                <p className="text-muted-foreground mt-0.5">Add purpose note explaining the difference.</p>
              </div>
            </div>
          )}
          <Button onClick={save} className="w-full">Save trip</Button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((t) => {
          const a = Number(t.km), e = Number(t.estimated_km || 0);
          const vp = e && a ? variancePct(a, e) : 0;
          const flag = e && a && Math.abs(vp) > VARIANCE_FLAG_PCT;
          return (
            <div key={t.id} className="rounded-xl bg-card border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={"shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded " + (t.is_personal ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>{t.is_personal ? "Personal" : "Business"}</span>
                  <p className="text-sm font-medium truncate">{t.start_location} → {t.end_location}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{tripKmTotal(a, t.round_trip)} km</p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground truncate">{t.trip_date}{t.round_trip ? " · round" : ""}{t.purpose ? ` · ${t.purpose}` : ""}</p>
                {e > 0 && (
                  <p className={"text-[11px] tabular-nums shrink-0 ml-2 " + (flag ? "text-[oklch(0.55_0.15_60)] font-semibold" : "text-muted-foreground")}>
                    OSM {e}km {flag && <AlertTriangle className="inline h-3 w-3" />} {vp > 0 ? "+" : ""}{vp.toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No trips yet.</p>}
      </div>
    </div>
  );
}

/* ---------- Fuel ---------- */

function FuelPanel({ rows, teamId, userId, onSaved }: { rows: any[]; allRows: any[]; teamId?: string; userId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const blank = { expense_date: new Date().toISOString().slice(0, 10), amount: "", litres: "", price_per_litre: "", station: "", odometer_km: "", notes: "" };
  const [f, setF] = useState(blank);

  // auto-cross-fill: amount = litres * price
  useEffect(() => {
    const L = Number(f.litres), P = Number(f.price_per_litre);
    if (L > 0 && P > 0 && !f.amount) setF((p) => ({ ...p, amount: (L * P).toFixed(2) }));
  }, [f.litres, f.price_per_litre]);

  async function save() {
    if (!teamId || !userId || !f.amount) { toast.error("Amount required"); return; }
    const { error } = await supabase.from("vehicle_expenses").insert({
      team_id: teamId, created_by: userId, expense_date: f.expense_date,
      category: "gas", amount: Number(f.amount),
      litres: f.litres ? Number(f.litres) : null,
      price_per_litre: f.price_per_litre ? Number(f.price_per_litre) : null,
      station: f.station || null,
      vendor: f.station || null,
      odometer_km: f.odometer_km ? Number(f.odometer_km) : null,
      notes: f.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Fill-up logged");
    setOpen(false); setF(blank); onSaved();
  }

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const totalL = rows.reduce((s, r) => s + Number(r.litres ?? 0), 0);
  const avgPpl = totalL > 0 ? total / totalL : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Spent (year)" value={cad(total)} icon={Fuel} />
        <Stat label="Litres" value={totalL ? totalL.toFixed(0) : "—"} />
        <Stat label="Avg $/L" value={avgPpl ? `$${avgPpl.toFixed(3)}` : "—"} />
      </div>

      {!open ? (
        <Button onClick={() => setOpen(true)} className="w-full h-12"><Plus className="h-4 w-4 mr-1.5" />Log fill-up</Button>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold">New fill-up</h2><button onClick={() => setOpen(false)} className="text-xs text-muted-foreground">Cancel</button></div>
          <div><Label className="text-xs">Date</Label><Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} /></div>
          <div><Label className="text-xs">Station</Label><Input value={f.station} onChange={(e) => setF({ ...f, station: e.target.value })} placeholder="Petro-Canada · King St" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Litres</Label><Input type="number" step="0.01" value={f.litres} onChange={(e) => setF({ ...f, litres: e.target.value, amount: "" })} /></div>
            <div><Label className="text-xs">$ / litre</Label><Input type="number" step="0.001" value={f.price_per_litre} onChange={(e) => setF({ ...f, price_per_litre: e.target.value, amount: "" })} /></div>
          </div>
          <div><Label className="text-xs">Total amount (CAD)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div><Label className="text-xs">Odometer reading</Label><Input type="number" value={f.odometer_km} onChange={(e) => setF({ ...f, odometer_km: e.target.value })} placeholder="km on dashboard" /></div>
          <div><Label className="text-xs">Notes</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <Button onClick={save} className="w-full">Save fill-up</Button>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl bg-card border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{r.station || r.vendor || "Fill-up"}</p>
              <p className="text-sm font-semibold tabular-nums">{cad(r.amount)}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {r.expense_date}
              {r.litres ? ` · ${Number(r.litres).toFixed(2)} L` : ""}
              {r.price_per_litre ? ` @ $${Number(r.price_per_litre).toFixed(3)}/L` : ""}
              {r.odometer_km ? ` · ${Math.round(r.odometer_km).toLocaleString()} km` : ""}
            </p>
          </div>
        ))}
        {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No fill-ups logged yet.</p>}
      </div>
    </div>
  );
}

/* ---------- Generic Expense / Maintenance panel ---------- */

function ExpensesPanel({ rows, teamId, userId, onSaved, cats, title }: { rows: any[]; teamId?: string; userId?: string; onSaved: () => void; cats: readonly { v: string; l: string }[]; title: string }) {
  const [open, setOpen] = useState(false);
  const blank = { expense_date: new Date().toISOString().slice(0, 10), category: cats[0].v, amount: "", vendor: "", odometer_km: "", notes: "" };
  const [f, setF] = useState(blank);

  async function save() {
    if (!teamId || !userId || !f.amount) { toast.error("Amount required"); return; }
    const { error } = await supabase.from("vehicle_expenses").insert({
      team_id: teamId, created_by: userId, expense_date: f.expense_date,
      category: f.category as any, amount: Number(f.amount), vendor: f.vendor || null,
      odometer_km: f.odometer_km ? Number(f.odometer_km) : null, notes: f.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success(`${title} logged`);
    setOpen(false); setF(blank); onSaved();
  }

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-3">
      <Stat label={`${title} total (year)`} value={cad(total)} hint={`${rows.length} entries · feeds CRA deduction`} />

      {!open ? (
        <Button onClick={() => setOpen(true)} className="w-full h-12"><Plus className="h-4 w-4 mr-1.5" />Add {title.toLowerCase()}</Button>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold">New {title.toLowerCase()}</h2><button onClick={() => setOpen(false)} className="text-xs text-muted-foreground">Cancel</button></div>
          <div><Label className="text-xs">Date</Label><Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} /></div>
          <div><Label className="text-xs">Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Amount (CAD)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div><Label className="text-xs">Vendor / Shop</Label><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></div>
          <div><Label className="text-xs">Odometer reading (optional)</Label><Input type="number" value={f.odometer_km} onChange={(e) => setF({ ...f, odometer_km: e.target.value })} /></div>
          <div><Label className="text-xs">Notes</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <Button onClick={save} className="w-full">Save</Button>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r) => {
          const lab = cats.find((c) => c.v === r.category)?.l ?? r.category;
          return (
            <div key={r.id} className="rounded-xl bg-card border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{lab}{r.vendor ? ` · ${r.vendor}` : ""}</p>
                <p className="text-sm font-semibold tabular-nums">{cad(r.amount)}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{r.expense_date}{r.odometer_km ? ` · ${Math.round(r.odometer_km).toLocaleString()} km` : ""}{r.notes ? ` · ${r.notes}` : ""}</p>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No entries yet.</p>}
      </div>
    </div>
  );
}

/* ---------- Odometer (inline on dashboard) ---------- */

function OdometerCard({ row, year, teamId, userId, onSaved }: { row: any; year: number; teamId?: string; userId?: string; onSaved: () => void }) {
  const [start, setStart] = useState<string>(row?.start_km != null ? String(row.start_km) : "");
  const [end, setEnd] = useState<string>(row?.end_km != null ? String(row.end_km) : "");

  useEffect(() => {
    setStart(row?.start_km != null ? String(row.start_km) : "");
    setEnd(row?.end_km != null ? String(row.end_km) : "");
  }, [row?.id]);

  async function save() {
    if (!teamId || !userId) return;
    const payload = { team_id: teamId, created_by: userId, year, start_km: start ? Number(start) : null, end_km: end ? Number(end) : null };
    const { error } = await supabase.from("odometer_readings").upsert(payload, { onConflict: "team_id,year" });
    if (error) return toast.error(error.message);
    toast.success("Odometer saved");
    onSaved();
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div>
        <h2 className="font-semibold">{year} odometer</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Start + end of year. Drives the business-use % calc.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Jan 1</Label><Input type="number" value={start} onChange={(e) => setStart(e.target.value)} placeholder="124,500" /></div>
        <div><Label className="text-xs">Dec 31</Label><Input type="number" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="At year-end" /></div>
      </div>
      <Button onClick={save} className="w-full" variant="secondary">Save odometer</Button>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Car, Plus, Route as RouteIcon, Fuel, Gauge, MapPin, AlertTriangle, Receipt, Percent } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/logbook")({ component: Logbook });

const VEH_CATS = [
  { v: "gas", l: "Gas / Fuel" }, { v: "insurance", l: "Insurance" },
  { v: "oil_change", l: "Oil Change" }, { v: "tires", l: "Tires" },
  { v: "registration", l: "Registration / Plates" }, { v: "repairs", l: "Repairs / Maintenance" },
  { v: "parking", l: "Parking / Tolls" }, { v: "car_wash", l: "Car Wash" },
  { v: "lease", l: "Lease / Loan Payment" }, { v: "other", l: "Other" },
] as const;

function Logbook() {
  const { team } = useTeam();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dashboard" | "trips" | "expenses" | "odometer">("dashboard");

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
  const businessKm = yearTrips.reduce((s, t) => s + tripKmTotal(Number(t.km), t.round_trip), 0);
  const totalKm = odo?.start_km != null && odo?.end_km != null ? Math.max(0, Number(odo.end_km) - Number(odo.start_km)) : 0;
  const personalKm = Math.max(0, totalKm - businessKm);
  const businessPct = totalKm > 0 ? (businessKm / totalKm) * 100 : 0;
  const yearVexp = vexp.filter((e) => e.expense_date >= ystart);
  const totalVehExp = yearVexp.reduce((s, e) => s + Number(e.amount), 0);
  const craDeduction = totalVehExp * (businessPct / 100);

  const tabs = [
    { id: "dashboard" as const, l: "Dashboard", i: Gauge },
    { id: "trips" as const, l: "Trips", i: RouteIcon },
    { id: "expenses" as const, l: "Vehicle $", i: Fuel },
    { id: "odometer" as const, l: "Odometer", i: Car },
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
            <Stat label="Business km" value={`${Math.round(businessKm).toLocaleString()}`} icon={RouteIcon} hint={`${yearTrips.length} trips`} />
            <Stat label="Personal km" value={`${Math.round(personalKm).toLocaleString()}`} icon={MapPin} />
            <Stat label="Business use" value={`${businessPct.toFixed(1)}%`} icon={Percent} tone={businessPct > 0 ? "success" : "default"} />
          </div>

          <div className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">CRA Deduction (Actual Method)</p>
            <p className="mt-1.5 text-3xl font-semibold tabular-nums text-[oklch(0.55_0.16_152)]">{cad(craDeduction)}</p>
            <p className="text-xs text-muted-foreground mt-1">{cad(totalVehExp)} vehicle expenses × {businessPct.toFixed(1)}% business use</p>
            {totalKm === 0 && <p className="text-xs text-[oklch(0.55_0.15_60)] mt-2">⚠ Enter odometer readings to calculate business-use %.</p>}
          </div>

          <div className="rounded-xl bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">How CRA wants it</p>
            <p>Track every business trip + every vehicle expense + odometer at start and end of the year. Your deduction = actual vehicle costs × business-use %. Auditable, defensible.</p>
          </div>
        </div>
      )}

      {tab === "trips" && <TripsPanel trips={trips} teamId={team?.id} userId={user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["trips", team?.id] })} />}

      {tab === "expenses" && <ExpensesPanel rows={vexp} teamId={team?.id} userId={user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["vehicle_expenses", team?.id] })} />}

      {tab === "odometer" && <OdometerPanel row={odo} year={year} teamId={team?.id} userId={user?.id} onSaved={() => qc.invalidateQueries({ queryKey: ["odometer", team?.id, year] })} />}
    </div>
  );
}

function TripsPanel({ trips, teamId, userId, onSaved }: { trips: any[]; teamId?: string; userId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [f, setF] = useState({ trip_date: new Date().toISOString().slice(0, 10), start_location: "", end_location: "", km: "", estimated_km: "", round_trip: false, purpose: "" });

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
      round_trip: f.round_trip, purpose: f.purpose || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Trip logged");
    setOpen(false);
    setF({ trip_date: new Date().toISOString().slice(0, 10), start_location: "", end_location: "", km: "", estimated_km: "", round_trip: false, purpose: "" });
    onSaved();
  }

  const est = Number(f.estimated_km || 0);
  const actual = Number(f.km || 0);
  const v = est && actual ? variancePct(actual, est) : 0;
  const flagged = est && actual && Math.abs(v) > VARIANCE_FLAG_PCT;

  return (
    <div className="space-y-3">
      {!open ? (
        <Button onClick={() => setOpen(true)} className="w-full h-12"><Plus className="h-4 w-4 mr-1.5" />Log a trip</Button>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold">New trip</h2><button onClick={() => setOpen(false)} className="text-xs text-muted-foreground">Cancel</button></div>
          <div><Label className="text-xs">Date</Label><Input type="date" value={f.trip_date} onChange={(e) => setF({ ...f, trip_date: e.target.value })} /></div>
          <div><Label className="text-xs">Start address</Label><Input value={f.start_location} onChange={(e) => setF({ ...f, start_location: e.target.value, estimated_km: "" })} placeholder="123 Main St, Toronto" /></div>
          <div><Label className="text-xs">End address</Label><Input value={f.end_location} onChange={(e) => setF({ ...f, end_location: e.target.value, estimated_km: "" })} placeholder="456 King St, Hamilton" /></div>
          <Button type="button" variant="secondary" className="w-full" onClick={autoEstimate} disabled={estimating || !f.start_location || !f.end_location}>
            <MapPin className="h-4 w-4 mr-1.5" />{estimating ? "Calculating…" : "Auto-calculate driving distance"}
          </Button>
          {est > 0 && <div className="text-sm flex justify-between rounded-lg bg-muted/60 p-2"><span className="text-muted-foreground">OSM driving distance</span><span className="font-semibold">{est} km</span></div>}
          <div><Label className="text-xs">Actual km driven (one way)</Label><Input type="number" step="0.1" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} /></div>
          <div className="flex items-center justify-between"><Label className="text-sm">Round trip</Label><Switch checked={f.round_trip} onCheckedChange={(v2) => setF({ ...f, round_trip: v2 })} /></div>
          <div><Label className="text-xs">Business purpose</Label><Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="Pickup chair, supplier visit…" /></div>
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
        {trips.map((t) => {
          const a = Number(t.km), e = Number(t.estimated_km || 0);
          const vp = e && a ? variancePct(a, e) : 0;
          const flag = e && a && Math.abs(vp) > VARIANCE_FLAG_PCT;
          return (
            <div key={t.id} className="rounded-xl bg-card border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{t.start_location} → {t.end_location}</p>
                <p className="text-sm font-semibold tabular-nums">{tripKmTotal(a, t.round_trip)} km</p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">{t.trip_date}{t.round_trip ? " · round" : ""}{t.purpose ? ` · ${t.purpose}` : ""}</p>
                {e > 0 && (
                  <p className={"text-[11px] tabular-nums " + (flag ? "text-[oklch(0.55_0.15_60)] font-semibold" : "text-muted-foreground")}>
                    OSM {e}km {flag && <AlertTriangle className="inline h-3 w-3" />} {vp > 0 ? "+" : ""}{vp.toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {trips.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No trips logged yet.</p>}
      </div>
    </div>
  );
}

function ExpensesPanel({ rows, teamId, userId, onSaved }: { rows: any[]; teamId?: string; userId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ expense_date: new Date().toISOString().slice(0, 10), category: "gas" as typeof VEH_CATS[number]["v"], amount: "", vendor: "", odometer_km: "", notes: "" });

  async function save() {
    if (!teamId || !userId || !f.amount) { toast.error("Amount required"); return; }
    const { error } = await supabase.from("vehicle_expenses").insert({
      team_id: teamId, created_by: userId, expense_date: f.expense_date,
      category: f.category, amount: Number(f.amount), vendor: f.vendor || null,
      odometer_km: f.odometer_km ? Number(f.odometer_km) : null, notes: f.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Vehicle expense logged");
    setOpen(false);
    setF({ expense_date: new Date().toISOString().slice(0, 10), category: "gas", amount: "", vendor: "", odometer_km: "", notes: "" });
    onSaved();
  }

  const ystart = `${new Date().getFullYear()}-01-01`;
  const yearTotal = rows.filter((r) => r.expense_date >= ystart).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3">
        <Stat label="Vehicle Costs (Year)" value={cad(yearTotal)} icon={Receipt} hint={`${rows.filter((r) => r.expense_date >= ystart).length} entries · feeds CRA deduction`} />
      </div>

      {!open ? (
        <Button onClick={() => setOpen(true)} className="w-full h-12"><Plus className="h-4 w-4 mr-1.5" />Add vehicle expense</Button>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold">New vehicle expense</h2><button onClick={() => setOpen(false)} className="text-xs text-muted-foreground">Cancel</button></div>
          <div><Label className="text-xs">Date</Label><Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} /></div>
          <div><Label className="text-xs">Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v as typeof f.category })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VEH_CATS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Amount (CAD)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div><Label className="text-xs">Vendor</Label><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} placeholder="Petro-Canada, Mr. Lube…" /></div>
          <div><Label className="text-xs">Odometer reading (optional)</Label><Input type="number" value={f.odometer_km} onChange={(e) => setF({ ...f, odometer_km: e.target.value })} placeholder="km on dashboard" /></div>
          <div><Label className="text-xs">Notes</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <Button onClick={save} className="w-full">Save expense</Button>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r) => {
          const lab = VEH_CATS.find((c) => c.v === r.category)?.l ?? r.category;
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
        {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No vehicle expenses logged yet.</p>}
      </div>
    </div>
  );
}

function OdometerPanel({ row, year, teamId, userId, onSaved }: { row: any; year: number; teamId?: string; userId?: string; onSaved: () => void }) {
  const [start, setStart] = useState<string>(row?.start_km != null ? String(row.start_km) : "");
  const [end, setEnd] = useState<string>(row?.end_km != null ? String(row.end_km) : "");

  async function save() {
    if (!teamId || !userId) return;
    const payload = { team_id: teamId, created_by: userId, year, start_km: start ? Number(start) : null, end_km: end ? Number(end) : null };
    const { error } = await supabase.from("odometer_readings").upsert(payload, { onConflict: "team_id,year" });
    if (error) return toast.error(error.message);
    toast.success("Odometer saved");
    onSaved();
  }

  const total = start && end ? Math.max(0, Number(end) - Number(start)) : 0;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        <div>
          <h2 className="font-semibold">{year} odometer readings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Personal km = total km − business km. CRA wants both readings on file.</p>
        </div>
        <div><Label className="text-xs">Reading on Jan 1, {year}</Label><Input type="number" value={start} onChange={(e) => setStart(e.target.value)} placeholder="e.g. 124,500" /></div>
        <div><Label className="text-xs">Reading on Dec 31, {year}</Label><Input type="number" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="Update at year-end" /></div>
        {total > 0 && (
          <div className="rounded-lg bg-muted/60 p-2 text-sm flex justify-between">
            <span className="text-muted-foreground">Total km this year</span>
            <span className="font-semibold tabular-nums">{Math.round(total).toLocaleString()} km</span>
          </div>
        )}
        <Button onClick={save} className="w-full">Save</Button>
      </div>
      <div className="rounded-xl bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Tip</p>
        <p>Snap a photo of your odometer on Jan 1 and Dec 31. If audited, CRA may ask for it.</p>
      </div>
    </div>
  );
}

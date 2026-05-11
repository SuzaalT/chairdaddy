import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { useAuth } from "@/hooks/use-auth";
import { Stat } from "@/components/Stat";
import { cad, CRA_KM_RATE, tripDeduction, tripKmTotal } from "@/lib/cra";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Car, Plus, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/logbook")({ component: Logbook });

function Logbook() {
  const { team } = useTeam();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ trip_date: new Date().toISOString().slice(0, 10), start_location: "", end_location: "", km: "", round_trip: false, purpose: "" });

  const { data: trips = [] } = useQuery({
    queryKey: ["trips", team?.id],
    enabled: !!team,
    queryFn: async () => (await supabase.from("trips").select("*").eq("team_id", team!.id).order("trip_date", { ascending: false })).data ?? [],
  });

  const ystart = new Date(new Date().getFullYear(), 0, 1);
  const yearTrips = trips.filter((t) => new Date(t.trip_date) >= ystart);
  const yearKm = yearTrips.reduce((s, t) => s + tripKmTotal(Number(t.km), t.round_trip), 0);
  const yearDeduction = yearTrips.reduce((s, t) => s + tripDeduction(Number(t.km), t.round_trip), 0);

  async function save() {
    if (!team || !user || !f.km || !f.start_location || !f.end_location) return;
    const { error } = await supabase.from("trips").insert({
      team_id: team.id, created_by: user.id, trip_date: f.trip_date,
      start_location: f.start_location, end_location: f.end_location,
      km: Number(f.km), round_trip: f.round_trip, purpose: f.purpose || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Trip logged");
    setOpen(false);
    setF({ trip_date: new Date().toISOString().slice(0, 10), start_location: "", end_location: "", km: "", round_trip: false, purpose: "" });
    qc.invalidateQueries({ queryKey: ["trips", team.id] });
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <h1 className="text-2xl font-bold tracking-tight mb-3">Vehicle Logbook</h1>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat label="Km This Year" value={`${Math.round(yearKm)}`} icon={RouteIcon} hint={`${yearTrips.length} trips`} />
        <Stat label="CRA Deduction" value={cad(yearDeduction)} tone="success" icon={Car} hint={`@ $${CRA_KM_RATE}/km`} />
      </div>

      {!open ? (
        <Button onClick={() => setOpen(true)} className="w-full h-12 mb-4"><Plus className="h-4 w-4 mr-1.5" />Add trip</Button>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3 mb-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold">New trip</h2><button onClick={() => setOpen(false)} className="text-xs text-muted-foreground">Cancel</button></div>
          <div><Label className="text-xs">Date</Label><Input type="date" value={f.trip_date} onChange={(e) => setF({ ...f, trip_date: e.target.value })} /></div>
          <div><Label className="text-xs">Start</Label><Input value={f.start_location} onChange={(e) => setF({ ...f, start_location: e.target.value })} /></div>
          <div><Label className="text-xs">End</Label><Input value={f.end_location} onChange={(e) => setF({ ...f, end_location: e.target.value })} /></div>
          <div><Label className="text-xs">Km (one way)</Label><Input type="number" step="0.1" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} /></div>
          <div className="flex items-center justify-between"><Label className="text-sm">Round trip</Label><Switch checked={f.round_trip} onCheckedChange={(v) => setF({ ...f, round_trip: v })} /></div>
          <div><Label className="text-xs">Business purpose</Label><Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="Pickup chair, supplier visit…" /></div>
          {f.km && (
            <div className="rounded-lg bg-muted/60 p-2 text-sm flex justify-between">
              <span className="text-muted-foreground">Deduction</span>
              <span className="font-semibold">{cad(tripDeduction(Number(f.km), f.round_trip))}</span>
            </div>
          )}
          <Button onClick={save} className="w-full">Save trip</Button>
        </div>
      )}

      <div className="space-y-2">
        {trips.map((t) => (
          <div key={t.id} className="rounded-xl bg-card border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t.start_location} → {t.end_location}</p>
              <p className="text-sm font-semibold tabular-nums">{cad(tripDeduction(Number(t.km), t.round_trip))}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t.trip_date} · {tripKmTotal(Number(t.km), t.round_trip)} km{t.round_trip ? " (round)" : ""}{t.purpose ? ` · ${t.purpose}` : ""}</p>
          </div>
        ))}
        {trips.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No trips logged yet.</p>}
      </div>
    </div>
  );
}

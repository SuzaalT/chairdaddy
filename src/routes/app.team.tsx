import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { useAuth } from "@/hooks/use-auth";
import { useIsOwner, usePermission, PERMISSIONS } from "@/hooks/use-permission";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Map as MapIcon, Settings2, UserPlus, Copy } from "lucide-react";
import { toast } from "sonner";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const Route = createFileRoute("/app/team")({ component: Team });

type Loc = { user_id: string; lat: number | null; lng: number | null; sharing: boolean; updated_at: string };
type Member = { user_id: string; role: string; full_name: string | null; email: string | null };

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", co_owner: "Co-Owner", partner: "Partner", staff: "Staff", viewer: "Viewer", member: "Member",
};

function Team() {
  const { team } = useTeam();
  const { user } = useAuth();
  const isOwner = useIsOwner();
  const canInvite = usePermission(PERMISSIONS.TEAM_INVITE);
  const canViewLocations = usePermission(PERMISSIONS.LOCATION_VIEW_OTHERS);
  const [members, setMembers] = useState<Member[]>([]);
  const [locs, setLocs] = useState<Record<string, Loc>>({});
  const [sharing, setSharing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<string>("staff");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoords = useRef<{ lat: number; lng: number } | null>(null);

  // Load members + locations
  useEffect(() => {
    if (!team) return;
    (async () => {
      const { data: tm } = await supabase.from("team_members").select("user_id, role").eq("team_id", team.id);
      const ids = (tm ?? []).map((m) => m.user_id);
      if (ids.length === 0) { setMembers([]); return; }
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      setMembers((tm ?? []).map((m) => {
        const p = profs?.find((x) => x.id === m.user_id);
        return { user_id: m.user_id, role: m.role, full_name: p?.full_name ?? null, email: p?.email ?? null };
      }));
    })();
    supabase.from("member_locations").select("*").eq("team_id", team.id).then(({ data }) => {
      const map: Record<string, Loc> = {};
      (data as Loc[] | null)?.forEach((l) => { map[l.user_id] = l; });
      setLocs(map);
    });
    const ch = supabase
      .channel(`team-loc:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "member_locations", filter: `team_id=eq.${team.id}` },
        (p) => setLocs((prev) => ({ ...prev, [(p.new as Loc).user_id]: p.new as Loc })))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [team]);

  // Detect existing sharing state
  useEffect(() => {
    if (!user) return;
    const mine = locs[user.id];
    if (mine?.sharing && !sharing) setSharing(true);
  }, [locs, user]);

  async function pushLocation(lat: number, lng: number) {
    if (!team || !user) return;
    lastCoords.current = { lat, lng };
    await supabase.from("member_locations").upsert({
      team_id: team.id, user_id: user.id, lat, lng, sharing: true, updated_at: new Date().toISOString(),
    }, { onConflict: "team_id,user_id" } as any);
  }

  function startSharing() {
    if (!team || !user) return;
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => { lastCoords.current = { lat: p.coords.latitude, lng: p.coords.longitude }; },
      (e) => toast.error(e.message),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    // Initial push + 15s interval
    navigator.geolocation.getCurrentPosition((p) => pushLocation(p.coords.latitude, p.coords.longitude));
    intervalRef.current = setInterval(() => {
      if (lastCoords.current) pushLocation(lastCoords.current.lat, lastCoords.current.lng);
    }, 15000);
  }

  async function stopSharing() {
    if (!team || !user) return;
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    watchId.current = null; intervalRef.current = null;
    setSharing(false);
    await supabase.from("member_locations").upsert({
      team_id: team.id, user_id: user.id, sharing: false, updated_at: new Date().toISOString(),
    }, { onConflict: "team_id,user_id" } as any);
  }

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  async function createInvite() {
    if (!team) return;
    const { data, error } = await supabase.rpc("create_team_invite", { _team_id: team.id, _role: inviteRole as any });
    if (error) return toast.error(error.message);
    setInviteCode(data as string);
  }

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    toast.success("Copied");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-150px)]">
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <div className="flex gap-2">
            {isOwner && (
              <Link to="/app/team/roles" className="inline-flex items-center text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted">
                <Settings2 className="h-3.5 w-3.5 mr-1" /> Manage Roles
              </Link>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-card border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Members</p>
            <div className="flex gap-2">
              {canInvite && (
                <Dialog open={inviteOpen} onOpenChange={(v) => { setInviteOpen(v); if (!v) setInviteCode(null); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><UserPlus className="h-3.5 w-3.5 mr-1" /> Invite</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create invite</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <label className="text-sm">Role to grant</label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="co_owner">Co-Owner</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      {inviteCode && (
                        <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
                          <div>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Invite code</p>
                            <p className="font-mono text-lg tracking-widest">{inviteCode}</p>
                          </div>
                          <Button size="icon" variant="ghost" onClick={copyCode}><Copy className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button onClick={createInvite}>{inviteCode ? "Generate another" : "Generate code"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              <Button size="sm" variant={sharing ? "default" : "outline"} onClick={() => sharing ? stopSharing() : startSharing()}>
                <MapPin className="h-3.5 w-3.5 mr-1" />{sharing ? "Sharing" : "Share location"}
              </Button>
            </div>
          </div>
          <ul className="space-y-1.5">
            {members.map((m) => {
              const loc = locs[m.user_id];
              const fresh = loc?.updated_at && (Date.now() - new Date(loc.updated_at).getTime()) < 5 * 60 * 1000;
              const isMe = user?.id === m.user_id;
              const showMap = loc?.sharing && fresh && loc.lat != null && loc.lng != null && (isMe || canViewLocations);
              return (
                <li key={m.user_id} className="flex items-center justify-between text-sm gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{m.full_name || m.email || "Member"} <span className="text-xs text-muted-foreground">· {ROLE_LABELS[m.role] ?? m.role}</span></p>
                    <p className={"text-xs " + (loc?.sharing && fresh ? "text-[oklch(0.5_0.16_152)]" : "text-muted-foreground")}>
                      {loc?.sharing && fresh ? "● Live" : "offline"}
                    </p>
                  </div>
                  {showMap && (
                    <a href={`https://www.google.com/maps?q=${loc!.lat},${loc!.lng}`} target="_blank" rel="noopener" className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/70">
                      <MapIcon className="h-3 w-3 mr-1" /> View on Map
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <ChatPanel members={members} />
    </div>
  );
}

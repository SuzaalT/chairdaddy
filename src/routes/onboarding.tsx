import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTeam } from "@/hooks/use-team";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, Plus } from "lucide-react";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user } = useAuth();
  const { team, refresh } = useTeam();
  const nav = useNavigate();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ team_name: string; role: string } | null>(null);

  if (!user) return <Navigate to="/login" />;
  if (team) return <Navigate to="/app" />;

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("create_team", { _name: name });
    setBusy(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Team created");
    nav({ to: "/app" });
  }
  async function lookup(c: string) {
    if (c.length < 4) { setPreview(null); return; }
    const { data } = await supabase.rpc("lookup_invite", { _code: c.toUpperCase() });
    const row = (data as any[] | null)?.[0];
    if (row) setPreview({ team_name: row.team_name, role: row.role });
    else setPreview(null);
  }
  async function joinTeam(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("join_team_by_code", { _code: code.toUpperCase() });
    setBusy(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Joined team");
    nav({ to: "/app" });
  }


  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-background">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Set up your team</h1>
        <p className="text-sm text-muted-foreground mt-1">All your flips, expenses and mileage live in one workspace. Create yours or join your partner's.</p>

        <div className="mt-6 grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
          <button onClick={() => setTab("create")} className={"py-2 rounded-lg text-sm font-medium " + (tab === "create" ? "bg-card shadow" : "text-muted-foreground")}>Create</button>
          <button onClick={() => setTab("join")} className={"py-2 rounded-lg text-sm font-medium " + (tab === "join" ? "bg-card shadow" : "text-muted-foreground")}>Join</button>
        </div>

        {tab === "create" ? (
          <form onSubmit={createTeam} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tname">Team name</Label>
              <Input id="tname" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Roy's Chairs" />
            </div>
            <Button disabled={busy || !name} className="w-full h-11"><Plus className="mr-2 h-4 w-4" />Create team</Button>
          </form>
        ) : (
          <form onSubmit={joinTeam} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">Invite code</Label>
              <Input id="code" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" className="uppercase tracking-widest" />
            </div>
            <Button disabled={busy || !code} className="w-full h-11"><Users className="mr-2 h-4 w-4" />Join team</Button>
          </form>
        )}
      </div>
    </div>
  );
}

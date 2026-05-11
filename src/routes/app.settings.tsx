import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, LogOut, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/settings")({ component: Settings });

function Settings() {
  const { team, profile, refresh } = useTeam();
  const { signOut } = useAuth();
  const nav = useNavigate();
  const [notify, setNotify] = useState("");
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [newUnit, setNewUnit] = useState("");

  useEffect(() => {
    if (profile) {
      setNotify(profile.notification_email ?? "");
      setKey(profile.anthropic_key ?? "");
      setName(profile.full_name ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (!team) return;
    supabase.from("storage_units").select("*").eq("team_id", team.id).then(({ data }) => setUnits(data ?? []));
  }, [team]);

  async function saveProfile() {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({
      full_name: name, notification_email: notify, anthropic_key: key,
    }).eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    refresh();
  }

  async function addUnit() {
    if (!team || !newUnit) return;
    const { data, error } = await supabase.from("storage_units").insert({ team_id: team.id, name: newUnit }).select().single();
    if (error) return toast.error(error.message);
    setUnits([...units, data]);
    setNewUnit("");
  }
  async function delUnit(id: string) {
    await supabase.from("storage_units").delete().eq("id", id);
    setUnits(units.filter((u) => u.id !== id));
  }

  async function copyCode() {
    if (!team) return;
    await navigator.clipboard.writeText(team.invite_code);
    toast.success("Invite code copied");
  }

  async function out() {
    await signOut();
    nav({ to: "/login" });
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Section title="Account">
        <div className="space-y-3 p-4">
          <div><Label className="text-xs">Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Notification email</Label><Input type="email" value={notify} onChange={(e) => setNotify(e.target.value)} placeholder="you@gmail.com" />
            <p className="text-[11px] text-muted-foreground mt-1">All chair save records are sent here.</p>
          </div>
          <div><Label className="text-xs">Anthropic API key</Label><Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" />
            <p className="text-[11px] text-muted-foreground mt-1">Used for Listing AI and receipt scanning. Stored privately on your profile.</p>
          </div>
          <Button onClick={saveProfile} className="w-full">Save profile</Button>
        </div>
      </Section>

      <Section title="Team">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{team?.name}</p>
              <p className="text-xs text-muted-foreground">Invite code</p>
            </div>
            <button onClick={copyCode} className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm font-mono tracking-widest">
              {team?.invite_code} <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Section>

      <Section title="Storage units">
        <div className="p-4 space-y-2">
          {units.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-sm">
              <span>{u.name}</span>
              <button onClick={() => delUnit(u.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="Unit 3" />
            <Button onClick={addUnit} size="icon"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </Section>

      <Button variant="outline" onClick={out} className="w-full"><LogOut className="h-4 w-4 mr-1.5" />Sign out</Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">{title}</h2>
      <div className="rounded-2xl bg-card border border-border">{children}</div>
    </div>
  );
}

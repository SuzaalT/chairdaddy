import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { useIsOwner } from "@/hooks/use-permission";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/team/roles")({ component: ManageRoles });

const ROLES: { id: string; label: string }[] = [
  { id: "co_owner", label: "Co-Owner" },
  { id: "partner", label: "Partner" },
  { id: "staff", label: "Staff" },
  { id: "viewer", label: "Viewer" },
];

const PERMS: { id: string; label: string; hint?: string }[] = [
  { id: "chair.delete", label: "Delete chairs" },
  { id: "chair.edit", label: "Edit chairs" },
  { id: "expense.delete", label: "Delete expenses" },
  { id: "expense.edit", label: "Edit expenses" },
  { id: "team.invite", label: "Create invite codes" },
  { id: "team.manage_roles", label: "Manage role permissions" },
  { id: "chat.delete_others", label: "Delete others' messages" },
  { id: "location.view_others", label: "View teammate locations" },
];

type Row = { role: string; permission: string; allowed: boolean };

function ManageRoles() {
  const { team, loading: teamLoading } = useTeam();
  const isOwner = useIsOwner();
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!team) return;
    (async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role, permission, allowed")
        .eq("team_id", team.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
      const m: Record<string, Record<string, boolean>> = {};
      ROLES.forEach((r) => { m[r.id] = {}; PERMS.forEach((p) => { m[r.id][p.id] = false; }); });
      (data as Row[] | null)?.forEach((row) => {
        if (!m[row.role]) m[row.role] = {};
        m[row.role][row.permission] = row.allowed;
      });
      setMatrix(m);
      setLoading(false);
    })();
  }, [team]);

  if (teamLoading || !team) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!isOwner) return <Navigate to="/app/team" />;


  async function toggle(role: string, permission: string, value: boolean) {
    setMatrix((prev) => ({ ...prev, [role]: { ...prev[role], [permission]: value } }));
    const { error } = await supabase
      .from("role_permissions")
      .upsert({ team_id: team!.id, role: role as any, permission, allowed: value, updated_at: new Date().toISOString() }, { onConflict: "team_id,role,permission" } as any);
    if (error) toast.error(error.message);
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <Link to="/app/team" className="flex items-center text-sm text-muted-foreground mb-3"><ChevronLeft className="h-4 w-4" /> Team</Link>
      <h1 className="text-2xl font-bold">Manage Roles</h1>
      <p className="text-sm text-muted-foreground mt-1">Owner always has full access. Toggle what each role can do.</p>

      {loading ? <p className="text-sm text-muted-foreground mt-6">Loading…</p> : (
        <div className="mt-5 space-y-4">
          {ROLES.map((r) => (
            <div key={r.id} className="rounded-2xl bg-card border border-border">
              <div className="px-4 py-3 border-b border-border">
                <p className="font-semibold">{r.label}</p>
              </div>
              <div className="divide-y divide-border">
                {PERMS.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p>{p.label}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{p.id}</p>
                    </div>
                    <Switch checked={!!matrix[r.id]?.[p.id]} onCheckedChange={(v) => toggle(r.id, p.id, v)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

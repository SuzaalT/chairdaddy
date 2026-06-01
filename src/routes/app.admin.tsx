import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAppAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Check, X, Hourglass } from "lucide-react";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
};

function AdminPage() {
  const { isAdmin, loading } = useIsAppAdmin();
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, approval_status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  async function setStatus(id: string, status: "approved" | "rejected" | "pending") {
    const { error } = await supabase.from("profiles").update({ approval_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/app" />;

  const pending = users.filter((u) => u.approval_status === "pending");
  const others = users.filter((u) => u.approval_status !== "pending");

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold tracking-tight">User approvals</h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Hourglass className="h-4 w-4" /> Pending ({pending.length})
        </h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && pending.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        )}
        <div className="space-y-2">
          {pending.map((u) => (
            <UserRow key={u.id} u={u} onApprove={() => setStatus(u.id, "approved")} onReject={() => setStatus(u.id, "rejected")} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">All users</h2>
        <div className="space-y-2">
          {others.map((u) => (
            <UserRow
              key={u.id}
              u={u}
              onApprove={u.approval_status !== "approved" ? () => setStatus(u.id, "approved") : undefined}
              onReject={u.approval_status !== "rejected" ? () => setStatus(u.id, "rejected") : undefined}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function UserRow({ u, onApprove, onReject }: { u: Row; onApprove?: () => void; onReject?: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{u.full_name || u.email || u.id}</p>
        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
      </div>
      <span
        className={
          "text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full " +
          (u.approval_status === "approved"
            ? "bg-emerald-500/15 text-emerald-600"
            : u.approval_status === "rejected"
              ? "bg-destructive/15 text-destructive"
              : "bg-amber-500/15 text-amber-600")
        }
      >
        {u.approval_status}
      </span>
      {onApprove && (
        <Button size="icon" variant="outline" className="h-9 w-9" onClick={onApprove} aria-label="Approve">
          <Check className="h-4 w-4" />
        </Button>
      )}
      {onReject && (
        <Button size="icon" variant="outline" className="h-9 w-9" onClick={onReject} aria-label="Reject">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

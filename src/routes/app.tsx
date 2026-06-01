import { createFileRoute, Outlet, Navigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTeam } from "@/hooks/use-team";
import { useIsAppAdmin } from "@/hooks/use-is-admin";
import { BottomNav } from "@/components/BottomNav";
import { Settings, Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { user, loading } = useAuth();
  const { team, profile, loading: tloading } = useTeam();
  const { isAdmin } = useIsAppAdmin();

  if (loading || tloading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (profile && profile.approval_status !== "approved") return <Navigate to="/pending" />;
  if (!team) return <Navigate to="/onboarding" />;

  const initials = (profile?.full_name || profile?.email || "?")
    .split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-dvh bg-background pb-safe-nav">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border safe-top safe-left safe-right">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/app" className="font-bold tracking-tight text-base">MarketplaceFlip <span className="text-muted-foreground font-normal">· {team.name}</span></Link>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Link to="/app/admin" className="h-11 w-11 grid place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="Admin">
                <ShieldCheck className="h-5 w-5" />
              </Link>
            )}
            <Link to="/app/team" className="h-11 w-11 grid place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="Team">
              <Users className="h-5 w-5" />
            </Link>
            <Link to="/app/settings" className="h-11 w-11 grid place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </Link>
            <Link to="/app/team" className="ml-1 h-11 w-11 rounded-full bg-accent text-accent-foreground grid place-items-center text-xs font-semibold">
              {initials}
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

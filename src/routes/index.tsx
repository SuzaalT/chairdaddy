import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTeam } from "@/hooks/use-team";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const { team, profile, loading: tloading } = useTeam();
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
  return <Navigate to="/app" />;
}

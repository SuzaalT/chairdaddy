import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTeam } from "@/hooks/use-team";
import { Button } from "@/components/ui/button";
import { Hourglass } from "lucide-react";

export const Route = createFileRoute("/pending")({ component: PendingPage });

function PendingPage() {
  const { user, loading, signOut } = useAuth();
  const { profile, loading: ploading } = useTeam();

  if (loading || ploading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (profile?.approval_status === "approved") return <Navigate to="/" />;

  const rejected = profile?.approval_status === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-accent text-accent-foreground grid place-items-center">
          <Hourglass className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {rejected ? "Access denied" : "Awaiting admin approval"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {rejected
            ? "Your account was not approved. Please contact the administrator if you believe this is a mistake."
            : "Your account has been created. An administrator must approve your access before you can use the app. You'll be able to sign in once approved."}
        </p>
        <Button variant="outline" onClick={() => signOut()} className="w-full h-11">
          Sign out
        </Button>
      </div>
    </div>
  );
}

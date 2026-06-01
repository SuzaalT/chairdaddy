import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type Team = { id: string; name: string; invite_code: string; owner_id: string; brand_prefix: string };
export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  notification_email: string | null;
  anthropic_key: string | null;
  current_team_id: string | null;
  approval_status: "pending" | "approved" | "rejected";
};

type TeamCtx = {
  team: Team | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<TeamCtx | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTeam(null);
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    const { data: secret } = await supabase.from("user_secrets").select("anthropic_key").eq("user_id", user.id).maybeSingle();
    setProfile(prof ? ({ ...(prof as object), anthropic_key: secret?.anthropic_key ?? null } as Profile) : null);
    if (prof?.current_team_id) {
      const { data: t } = await supabase.from("teams").select("*").eq("id", prof.current_team_id).maybeSingle();
      setTeam(t as Team | null);
    } else {
      setTeam(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ team, profile, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useTeam() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTeam must be used within TeamProvider");
  return c;
}

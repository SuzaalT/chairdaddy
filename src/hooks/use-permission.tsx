import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useTeam } from "./use-team";

export const PERMISSIONS = {
  CHAIR_DELETE: "chair.delete",
  CHAIR_EDIT: "chair.edit",
  EXPENSE_DELETE: "expense.delete",
  EXPENSE_EDIT: "expense.edit",
  TEAM_INVITE: "team.invite",
  TEAM_MANAGE_ROLES: "team.manage_roles",
  CHAT_DELETE_OTHERS: "chat.delete_others",
  LOCATION_VIEW_OTHERS: "location.view_others",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function usePermission(permission: PermissionKey) {
  const { user } = useAuth();
  const { team } = useTeam();
  const { data = false } = useQuery({
    queryKey: ["permission", team?.id, user?.id, permission],
    enabled: !!team && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_permission", {
        _team_id: team!.id,
        _user_id: user!.id,
        _permission: permission,
      });
      if (error) return false;
      return !!data;
    },
  });
  return data;
}

export function useIsOwner() {
  const { user } = useAuth();
  const { team } = useTeam();
  return !!user && !!team && team.owner_id === user.id;
}

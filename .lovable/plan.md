## Overview

Five connected features. They share a foundation (a dynamic role/permission system), so the build order matters: permissions first, then everything else gates on them.

---

## 1. Dynamic Role Permission System (foundation)

**Database (migration):**
- `app_role` enum: `owner`, `co_owner`, `partner`, `staff`, `viewer`
- `team_members.role` migrated to use this enum (currently `team_role`)
- New table `role_permissions(team_id, role, permission, allowed)` — one row per (team, role, permission) toggle
- Permission keys (string constants, seeded per team on team creation):
  `chair.delete`, `chair.edit`, `expense.delete`, `expense.edit`, `team.invite`, `team.manage_roles`, `chat.delete_others`, `location.view_others`
- Security definer fn `has_permission(_team uuid, _user uuid, _permission text) returns boolean` — owner always returns true; others check `role_permissions`
- Seed defaults on `create_team`: owner=all, co_owner=most, partner=delete+edit, staff=edit only, viewer=none
- Trigger to seed `role_permissions` rows when a new team is created

**Frontend:**
- `usePermission(permission)` hook → queries `has_permission` RPC, cached
- `Settings → Team → Manage Roles` page (owner-only): matrix of roles × permissions with toggle switches; writes to `role_permissions`

---

## 2. Delete Stock

**Backend:** RLS policy on `chairs` DELETE → `is_team_member AND has_permission(team_id, auth.uid(), 'chair.delete')`

**Frontend:**
- Chair detail page (`app.inventory.$chairId.tsx`): "Delete" button at bottom, gated by `usePermission('chair.delete')`, opens AlertDialog confirmation. On confirm, delete row + navigate back to inventory.
- Inventory list (`app.inventory.tsx`): swipe-left gesture on each card reveals red Delete action (touch + pointer events, ~80px reveal). Confirmation dialog before actual delete.

---

## 3. Live Location Sharing

**Backend:**
- `member_locations` already exists. Enable realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE member_locations` and `REPLICA IDENTITY FULL`.

**Frontend (`app.team.tsx`):**
- Replace localStorage logic with: when "share" toggle is ON, `navigator.geolocation.watchPosition` + a 15s interval that upserts `{team_id, user_id, lat, lng, sharing: true, updated_at}` to `member_locations`.
- Subscribe to `member_locations` realtime channel filtered by team_id; update local state on INSERT/UPDATE.
- For each teammate sharing, show "View on Map" button → opens `https://maps.google.com/?q=<lat>,<lng>` in new tab.
- On toggle off / unmount: set `sharing=false`.

---

## 4. Chat System Rebuild

**Backend:**
- Add columns to `chat_messages`: `read_by jsonb default '[]'`, `delivered boolean default true`
- Add `chat_typing(team_id, user_id, updated_at)` table for typing presence (or use Supabase presence channel — simpler, no DB)
- Enable realtime on `chat_messages`

**Frontend (new `app.chat.tsx` or rebuild existing chat):**
- Paginated load: 50 messages newest-first, "Load older" on scroll-to-top with cursor on `created_at`
- Date separators rendered between messages spanning a day boundary
- Grouped bubbles: consecutive messages from same author within 2 min collapse spacing + share avatar
- Typing indicator: Supabase realtime presence channel; track local typing on input change (debounce 1.5s)
- Image messages: tap → fullscreen modal with pinch/zoom + download button (anchor `download` attr; on iOS opens share sheet → save to Photos)
- Read receipts: when chat is open, mark unread messages by appending current user_id to `read_by`. Status: sent (single grey tick), delivered (double grey), read by anyone other than sender (double blue)
- Realtime subscription updates list on INSERT/UPDATE

---

## 5. Invite by Role

**Backend:**
- Add `default_role app_role default 'staff'` column to `teams` (per-invite-code role) — or new table `team_invites(team_id, code, role, created_at, expires_at, used_count)` for multiple codes per team. Going with the latter — more flexible.
- Update `join_team_by_code(_code)` to look up role from `team_invites` and insert `team_members.role = invite.role`
- New RPC `create_team_invite(_team uuid, _role app_role) returns text` (owner-only via `has_permission('team.invite')`)

**Frontend:**
- `app.team.tsx`: Owner sees "Create Invite Link" button → choose role from dropdown → generates code, copyable
- Invite/join screen displays the role the user will receive

---

## Technical Details

**Files to create:**
- `supabase/migrations/<ts>_dynamic_roles.sql` — enum, role_permissions, RLS, seed trigger, has_permission()
- `supabase/migrations/<ts>_chat_realtime.sql` — read_by column, realtime publication
- `supabase/migrations/<ts>_team_invites.sql` — team_invites table + create_team_invite RPC + new join_team_by_code
- `src/hooks/use-permission.tsx`
- `src/components/SwipeToDelete.tsx`
- `src/routes/app.team.roles.tsx` — permission matrix
- `src/components/chat/` — MessageList, MessageBubble, DateSeparator, TypingIndicator, ImageViewer, ChatInput

**Files to edit:**
- `src/routes/app.inventory.$chairId.tsx` — delete button
- `src/routes/app.inventory.tsx` — swipe-to-delete cards
- `src/routes/app.team.tsx` — location realtime + invite-by-role
- existing chat route → rebuilt
- `src/integrations/supabase/types.ts` regenerates after migration

**Order of execution:**
1. Migration #1 (roles/permissions) → confirm
2. Migration #2 (chat) → confirm
3. Migration #3 (invites) → confirm
4. Then write all frontend code in one pass

Each migration approval gates the next. After all three approved, I'll build the UI in one shot.

---

## Open question

For the chat existing route — I see no `app.chat.tsx` in the file listing but earlier context mentioned chat. Should I check first whether there's an existing chat UI, or build it fresh as a new route under `/app/chat`?

## Fix: "Mark as Sold" button not appearing

**Why it's missing**
The button is gated on `canEdit = usePermission("chair.edit")`. That hook calls a Supabase RPC and defaults to `false` until the call resolves. If the team context isn't ready or the RPC is slow, the button never renders — even for the team Owner (you).

**Fix (1 file, ~3 lines)**

In `src/routes/app.inventory.$chairId.tsx`:

1. Also import `useIsOwner` from `@/hooks/use-permission`.
2. Compute `const isOwner = useIsOwner();` and `const canSell = isOwner || canEdit;`.
3. Change the button condition from `!isSold && canEdit` to `!isSold && canSell`.
4. Apply the same `canSell` gate to the **Delete chair** button (currently `canDelete`) — Owners should never be locked out by a slow RPC. Keep the `chair.delete` permission check too, just OR it with `isOwner`.

This mirrors the rule already in the database (`has_permission` returns TRUE for owners) but evaluates it instantly on the client so the button shows the moment the page renders.

**No DB or email changes** — sell flow and proof-of-sale email stay exactly as they are.
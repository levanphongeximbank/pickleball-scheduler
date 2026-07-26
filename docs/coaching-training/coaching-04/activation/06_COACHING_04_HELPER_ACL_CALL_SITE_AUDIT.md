# COACHING-04 — Helper EXECUTE call-site audit

**Purpose:** Decide whether revoking `anon` / `service_role` EXECUTE on the 12 blocked helpers is safe.  
**CODEX_DELETE_ALLOWED:** `NO`  
**Patch Owner GO:** `COACHING_04_HELPER_ACL_PATCH_OWNER_GO` (not granted)

## Exact 12 helper signatures

1. `public.coaching_04_actor_uid()`
2. `public.coaching_04_active_coach_reference_id()`
3. `public.coaching_04_coach_assigned_to_player(text, text)`
4. `public.coaching_04_coach_owns_session(text)`
5. `public.coaching_04_coach_can_access_enrollment(text)`
6. `public.coaching_04_coach_can_access_program(text)`
7. `public.coaching_04_has_assigned_action(text)`
8. `public.coaching_04_mapped_player_id()`
9. `public.coaching_04_player_is_self(text)`
10. `public.coaching_04_player_identity_is_mapped()`
11. `public.coaching_04_has_self_action(text)`
12. `public.coaching_04_player_can_access_enrollment(text)`

## Call-site classes

| Class | Finding |
|-------|---------|
| Browser / client JS | **None.** No `rpc('coaching_04_*')` or direct helper imports under `src/`. |
| RLS policies | **Yes.** `20_*` and `21_*` policies invoke helpers under JWT/`authenticated` table access. |
| Mutation RPCs (`30_*`) | **Yes.** SECURITY DEFINER RPCs call helpers internally as invoker `authenticated`. |
| `service_role` app callers | **None** for these 12 helpers. Other modules use service_role elsewhere; not COACHING-04 helpers. |
| Tests / scripts | Static string / catalog references only (activation lib, audits, verification SQL). No live service_role EXECUTE dependency. |
| `anon` | **No legitimate dependency.** Helpers are JWT-scoped fail-closed; anon EXECUTE is accidental Supabase create-path grant. |

## Decision

- Keep / re-grant **`authenticated` EXECUTE** (required for RLS + authenticated RPC path).
- **REVOKE `anon`** — safe.
- **REVOKE `service_role`** — safe (no intentional dependency → not `COACHING_04_HELPER_ACL_SERVICE_ROLE_DEPENDENCY_BLOCKED`).
- **REVOKE `PUBLIC`** if present — safe.

Mutation RPC ACLs already hardened in `30_*`; patch must not drift them.

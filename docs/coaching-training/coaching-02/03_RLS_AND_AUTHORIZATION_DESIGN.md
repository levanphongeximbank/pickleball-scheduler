# COACHING-02 — RLS & Authorization Design

## Verified helpers only

- `auth.uid()`
- `public.user_venue_id()`
- `public.user_club_id()`
- `public.user_has_permission(text)`
- `public.is_super_admin()`

No invented `user_tenant_id()`. No `USING (true)` / `WITH CHECK (true)`.

## Tenant vs venue resolution (Conclusion A)

**Proof (canonical):** CUSTOMER-03 / CRM Phase 1G / Identity Sprint-2:

- Verified JWT binding is `profiles.venue_id` via `user_venue_id()`.
- No verified distinct `user_tenant_id()` exists.
- Therefore JWT policies require `tenant_id = user_venue_id()`.

**Coaching column semantics (must not be conflated):**

| Column | Meaning |
|--------|---------|
| `tenant_id` | Identity/tenant scope key for RLS — **venue-bound** under Sprint-2 (`= user_venue_id()`) |
| `club_id` | Club scope — `= user_club_id()` |
| `venue_id` (optional) | Operational typed reference to Venue & Court domain — **not** the tenant key |

Optional `venue_id` may differ from `tenant_id` in domain aggregates/tests. JWT still cannot read/write rows whose `tenant_id` ≠ `user_venue_id()`.

## Scope gate

`coaching_02_scope_allows(tenant_id, club_id)` requires authenticated caller with non-null venue/club bindings and exact matches.

## Action gate

`coaching_02_has_action(action)` → `is_super_admin() OR user_has_permission(action)`.

## Policy map (remediated)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| programs … evaluations (non-atomic) | `records.read` | dedicated create actions | dedicated update/create actions | none |
| attendance_records | `records.read` | `attendance.record` | **none** (RPC) | none |
| attendance_corrections | `records.read` | **none** (RPC) | **none** | **none** |
| entitlements | `records.read` | `entitlement.grant` | **none** (RPC consume) | none |
| usage_events | `records.read` | **none** (RPC) | **none** | **none** |

## SECURITY DEFINER RPCs

- Fixed `search_path = public, pg_temp`
- Actor from `auth.uid()` only — no payload `p_actor_id`
- Explicit scope + action checks; no service_role bypass path
- `REVOKE ALL … FROM PUBLIC` / `anon` / `service_role`
- `GRANT EXECUTE` to `authenticated` only
- Trusted-server / service_role actor contract **deferred** (COACHING-03)

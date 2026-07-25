# COACHING-04 — Scope & Security Model

**Workstream:** COACHING-04 — Assignment-aware RLS, scoped RPCs, UI cutover plan, localStorage retirement plan  
**Package path:** `docs/coaching-training/coaching-04/`  
**Status:** AUTHORED ONLY — do not apply SQL; do not flip runtime defaults; do not retire localStorage  
**Depends on:** COACHING-01 domain, COACHING-02 durable tables/RLS/RPCs (authored), COACHING-03 staging package (Owner GO separate)

---

## Verdict markers

| Marker | Meaning in this pack |
|--------|----------------------|
| `COACHING_04_ASSIGNMENT_MODEL_PROVEN` | Coach JWT → `coach_principal_id` → active `coach_reference_id` binding is defined and enforceable |
| `COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED` | No verified SoT maps `auth.uid()` → Coaching `player_id`; PLAYER grants/SQL helpers absent |
| `COACHING_DURABLE_RUNTIME_DEFAULT=false` | Durable runtime remains off; UI stays on legacy LS unless an explicit mode is selected |
| `LOCALSTORAGE_RETIRED=false` | Legacy store is not deleted/uploaded; retirement is plan-only |
| `ADMIN_GRANTS_NOT_NARROWED` | COACHING-02 admin permission+scope policies remain; COACHING-04 policies are additive (OR) |

---

## In scope (this step)

1. Document assignment security model (coach identity, relationships, deny-on-revoke).
2. Document PLAYER self-scope **block** with evidence and missing SoT.
3. Author UI cutover plan (page → runtime modes; no silent fallback).
4. Author localStorage retirement plan (export/discard; no silent upload/delete).
5. Author access matrix for all 13 Coaching tables.
6. Author **additive** SQL:
   - assignment helpers (`10_*`)
   - COACH scoped RLS policies (`20_*`)
   - scoped mutation RPCs (`30_*`)
   - COACH permission seed + grants proposal (`40_*`)
   - rollback (`90_*`) and verification (`99_*`)

---

## Out of scope (this step)

| Item | Rule |
|------|------|
| Apply any SQL (local / Staging / Production) | Forbidden |
| Modify `package.json` / lockfiles | Forbidden |
| Modify COACHING-02 SQL objects in place | Forbidden — keep policies; add `coaching_04_*` |
| Grant `coaching.records.read` to COACH | Forbidden (club-wide admin semantics) |
| Seed / grant PLAYER Coaching permissions | Forbidden (`COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED`) |
| Author `auth.uid()` → `player_id` mapping helpers | Forbidden — do not invent `profiles.player_id` reuse |
| Flip `COACHING_DURABLE_RUNTIME_DEFAULT` to true | Forbidden |
| Set `LOCALSTORAGE_RETIRED=true` / delete LS keys | Forbidden |
| Silent durable↔legacy fallback | Forbidden |
| Narrow admin COACHING-02 grants/policies | Forbidden |
| Production deploy / Owner GO for apply | Separate process |

---

## Security model (summary)

### Actors

| Actor | JWT | Coaching binding |
|-------|-----|------------------|
| Admin (venue/club managers, owners, super admin) | `auth.uid()` + `user_venue_id()` / `user_club_id()` | COACHING-02 policies: permission + tenant/club scope (`coaching.records.read` and admin mutate actions) |
| COACH | `auth.uid()` is JWT actor | Active `coaching_coach_references` row where `coach_principal_id = auth.uid()::text` and tenant/club match JWT venue/club |
| PLAYER | `auth.uid()` | **No proven map to `player_id`** → no PLAYER policies/grants this step |

### Assignment

- Source of truth: `coaching_coach_player_relationships`
- `status = active` → assigned access allowed (with permission)
- `status = inactive` → **revoked**; deny immediately on subsequent reads/mutations
- Sessions bind coaches via `coach_reference_id`
- Attendance / evaluations / entitlements / usage bind players via `player_id`

### Permission convention

Canonical ids: `coaching.<resource>.<verb>` in `public.permissions` with `module = 'coaching'`.

New COACHING-04 actions (proposal only):

- `coaching.assigned.read`
- `coaching.assigned.session.schedule`
- `coaching.assigned.attendance.record`
- `coaching.assigned.evaluation.submit`
- `coaching.assigned.entitlement.consume`

Admin keeps existing COACHING-02 catalog actions. COACH must **not** receive `coaching.records.read`.

### RLS composition

Postgres ORs policies of the same command. COACHING-04 adds `coaching_04_*` policies alongside COACHING-02 policies. Admin paths are unchanged. Coach paths require assignment helpers + assigned permissions. Fail-closed: no actor, no venue/club, no active coach ref, no assignment, missing permission → deny. No `USING (true)` / `WITH CHECK (true)`. No anon policies. No client DELETE on append-only / canonical history tables.

### Actor integrity on RPCs

Scoped RPCs always set `actor_id = auth.uid()::text`. Client-supplied actor ids are rejected / not accepted.

---

## Safety constraints

1. Fail-closed helpers and policies.
2. Fixed `search_path = public, pg_temp` on SECURITY DEFINER functions.
3. `REVOKE ALL … FROM PUBLIC` (+ anon where applicable); `GRANT EXECUTE` to `authenticated` only for intended helpers/RPCs.
4. Entitlement consume remains RPC-only for coaches (no direct UPDATE policy).
5. Inactive relationship or inactive coach reference → immediate deny.
6. Do not claim PLAYER self-read is complete.
7. Do not claim durable UI runtime is default.

---

## Package table of contents

| File | Purpose |
|------|---------|
| [00_COACHING_04_SCOPE_AND_SECURITY_MODEL.md](./00_COACHING_04_SCOPE_AND_SECURITY_MODEL.md) | This document — scope, gates, verdicts |
| [01_COACHING_04_ASSIGNMENT_MAPPING.md](./01_COACHING_04_ASSIGNMENT_MAPPING.md) | Coach identity + assignment lifecycle |
| [02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md](./02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md) | PLAYER mapping blocked |
| [03_COACHING_04_UI_CUTOVER_PLAN.md](./03_COACHING_04_UI_CUTOVER_PLAN.md) | 10-page consumer graph + runtime modes |
| [04_COACHING_04_LOCALSTORAGE_RETIREMENT_PLAN.md](./04_COACHING_04_LOCALSTORAGE_RETIREMENT_PLAN.md) | LS schema, risks, export/discard |
| [05_COACHING_04_ACCESS_MATRIX.md](./05_COACHING_04_ACCESS_MATRIX.md) | 13-table access matrix |
| [10_COACHING_04_ASSIGNMENT_HELPERS.sql](./10_COACHING_04_ASSIGNMENT_HELPERS.sql) | SECURITY DEFINER assignment helpers |
| [20_COACHING_04_ASSIGNMENT_RLS.sql](./20_COACHING_04_ASSIGNMENT_RLS.sql) | Additive `coaching_04_*` policies |
| [30_COACHING_04_SCOPED_RPCS.sql](./30_COACHING_04_SCOPED_RPCS.sql) | Assigned attendance / evaluation / consume RPCs |
| [40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql](./40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql) | Seed + COACH grants (PROPOSAL) |
| [90_COACHING_04_ROLLBACK.sql](./90_COACHING_04_ROLLBACK.sql) | Drop only COACHING-04 objects |
| [99_COACHING_04_VERIFICATION.sql](./99_COACHING_04_VERIFICATION.sql) | Read-only verification queries |

---

## Entry conditions before any apply (future Owner gate)

1. COACHING-02 tables + helpers + base RLS present (or Staging certified under COACHING-03).
2. Owner review of this pack, especially PLAYER block and COACH permission set.
3. Explicit apply token / GO (not granted in this authoring step).
4. Verification script pass on target environment.
5. Runtime defaults still false until a separate cutover GO.

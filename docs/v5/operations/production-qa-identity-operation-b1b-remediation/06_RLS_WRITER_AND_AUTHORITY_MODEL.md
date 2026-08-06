# 06 — RLS, Writer, and Authority Model

## Authority summary

| Action | `anon` | Normal authenticated user | Tenant owner / `user.manage` | SUPER_ADMIN (authenticated RPC) | Service-role operator |
|--------|--------|---------------------------|------------------------------|----------------------------------|------------------------|
| Read active quarantine (self) | NO | NO | NO (default) | YES (ops) | YES |
| Read audit inventory | NO | NO | Limited future (same venue audit) optional | YES | YES |
| Apply quarantine | NO | NO | NO | YES via RPC only | YES via runner/RPC |
| Release quarantine | NO | NO | NO | YES via RPC only | YES via runner/RPC |
| Direct table INSERT/UPDATE/DELETE | NO | NO | NO | NO | Prefer RPC; direct DML discouraged except break-glass |
| Mutate `profiles.status` for QA quarantine | NO | NO | NO | NO | **NO** (forbidden path) |
| Auth ban/unban | NO | NO | NO | Via Admin API patterns only | YES (runner) |

## Read authority

- Default: no client read of quarantine table
- SUPER_ADMIN may read via SECURITY DEFINER read RPC for ops tooling
- Optional later: venue-scoped audit read for `user.manage` — **must not** expose other tenants’ quarantine rows
- Directory/runtime should use boolean projector/`qa_quarantine_is_active` rather than broad SELECT grants

## Write authority

- Apply and release only through controlled interfaces
- Must validate exact profile/auth/email bind
- Must require non-empty reason and batch_id
- Must refuse non-allowlisted / non-certified identities at the **runner** layer (DB may additionally constrain original_status domain only)

## Release authority

Same as write authority. Release must:

- Target active row
- Enforce batch binding when batch-scoped
- Record `released_by`, `released_at`, `release_reason`

## Audit-read authority

- SUPER_ADMIN: full
- `user.manage`: only if productized and venue-scoped; otherwise deny
- Emit quarantine apply/release into `public.audit_logs` (or dedicated ops audit) with masked metadata in client-visible channels

## Service-role behavior

- Bypasses RLS (Postgres/Supabase default)
- Therefore **application runner guards are mandatory**: project-ref, GO, batch, allowlist hash, dry-run default
- Service-role must still call the same semantic writer functions where possible to keep invariants centralized
- Forbidden: ad-hoc SQL updating `profiles.status` to `quarantined` or `suspended` for QA hygiene

## SUPER_ADMIN behavior

- May call apply/release RPCs when authenticated path is enabled
- Must not self-quarantine bypass allowlist rules in Production runner
- Cannot use SUPER_ADMIN UI alone as substitute for Production Owner GO on bulk B1B execution

## Tenant owner behavior

- **Cannot** apply or release QA quarantine
- Tenant suspension of members remains `profiles.status='suspended'` via existing identity admin flows — distinct semantic

## Normal user behavior

- No read/write
- Self-service profile updates remain blocked from privileged fields by existing `profiles_guard_privileged_update` (status/role/venue/club)

## Self-write prohibition

- Users cannot insert their own quarantine row
- Users cannot set `privacy_settings` keys to fake quarantine authority
- Users cannot set `profiles.status` to `quarantined` (CHECK + guards)

## Tenant isolation

- Quarantine rows store `venue_id` snapshot
- Any authenticated read path must filter by venue unless SUPER_ADMIN
- Cross-tenant quarantine apply is platform ops only (service-role / SUPER_ADMIN), never tenant lateral movement

## SECURITY DEFINER RPC expectations

- `search_path = public` fixed
- Explicit AuthZ checks inside function body
- No reliance on caller grants for table DML
- Validate UUID formats and state transitions
- Return structured `{ ok, code, ... }` errors
- Never UPDATE `public.profiles.status`

## Direct table write policy

| Role | Policy |
|------|--------|
| `anon` / `authenticated` | No direct DML |
| `service_role` | Technically possible; **policy: use RPC/runner only** |
| SQL editor break-glass | Incident-only with Owner GO + evidence |

## Grant model

1. REVOKE ALL on table from PUBLIC/anon/authenticated
2. GRANT EXECUTE on RPCs to intended callers only
3. Do not GRANT UPDATE on `profiles` beyond existing needs for quarantine

## Audit logging

Each apply/release should record:

- actor
- action (`qa_quarantine.apply` / `qa_quarantine.release`)
- resource ids (profile/auth)
- batch_id
- reason
- success/failure code

No raw secrets; mask emails in shareable evidence.

## Forbidden writer paths

1. `UPDATE profiles SET status = 'quarantined'`
2. `UPDATE profiles SET status = 'suspended'` **for the purpose of QA quarantine**
3. Client-side writes to quarantine table
4. Overloading `privacy_settings` as quarantine SSOT
5. Auth ban **without** corresponding quarantine authority row (for B1B batch execution)
6. Quarantine authority row **without** allowlist bind in Production runner
7. Reuse of retired GO/batch as AuthZ

## Relationship to existing identity writers

| Existing writer | Quarantine interaction |
|-----------------|------------------------|
| `identity_admin_update_user` | May still set `active/suspended/invited` for real lifecycle — **not** QA quarantine |
| `updateProfileRowById` / player write repo | Must not gain quarantine columns-as-SSOT (C1 rejected) |
| `profiles_guard_privileged_update` | Remains; unchanged purpose |
| B1A `updateProfileStatus` | **Retired for quarantine purpose**; replace with quarantine authority writer in B1B runner |
| Auth Admin `updateUserById(ban_duration)` | Retained as complementary control after authority write |

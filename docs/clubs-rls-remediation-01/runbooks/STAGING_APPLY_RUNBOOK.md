# CLUBS-RLS-REMEDIATION-01 — Staging Apply Runbook

**Workstream:** Authenticated Cross-Tenant Club Metadata Isolation
**Blocker:** B-CLUBS-RLS-01 (HIGH)
**Parent audit:** PLATFORM-FINAL-AUDIT-01
**Locked baseline:** `adc43eb3979292a09687cf099404235583f7895e`
**Staging project ref:** `qyewbxjsiiyufanzcjcq`
**Production project ref (blocked):** `expuvcohlcjzvrrauvud`

## Status

- Package: authored
- Staging apply: **EXECUTED + CERTIFIED** (2026-07-27)
- Marker: `CLUBS_RLS_REMEDIATION_01_STAGING_CERTIFIED`
- Production apply: **FORBIDDEN** from this package

## Preconditions

1. Worktree on `feature/clubs-rls-remediation-01` with HEAD descendant of locked baseline.
2. Forward SQL byte-reviewed: `sql/10_CLUBS_RLS_REMEDIATION_01_FORWARD.sql`
3. Rollback ready: `sql/90_CLUBS_RLS_REMEDIATION_01_ROLLBACK.sql`
4. Static tests green (policy contract + public catalog + adjacent).
5. Owner written authorization for Staging only.
6. Backup / PITR window confirmed for Staging.

## Apply order

1. Connect to **Staging only** (`qyewbxjsiiyufanzcjcq`). Abort if Production ref.
2. Run `sql/00_CLUBS_RLS_REMEDIATION_01_PREFLIGHT.sql` (read-only). Capture results.
3. Confirm preflight shows `clubs_select_has_broad_status_active = true` (or document Staging already remediated).
4. Apply `sql/10_CLUBS_RLS_REMEDIATION_01_FORWARD.sql` in one transaction.
5. Run `sql/20_CLUBS_RLS_REMEDIATION_01_POST_APPLY_VERIFY.sql`.
6. Execute negative matrix N1–N10 with Staging fixtures (JWT / SQL Editor SET ROLE).
7. Smoke Club Management: list registry, club get, membership, governance read.
8. Smoke Public Portal / catalog: `public_catalog_list_clubs`.
9. File evidence under `evidence/` (no secrets).

## Implementation note (recursion-safe member path)

Active club-member access uses `public.phase42_active_club_member_id(id) IS NOT NULL`
(SECURITY DEFINER). A direct `EXISTS (SELECT … FROM club_members …)` inside
`clubs_select` re-enters `club_members_select` and raises infinite recursion.
The historical broad `OR status = 'active'` masked this path for active clubs.

## Stop conditions

- Connection resolves to Production ref `expuvcohlcjzvrrauvud`
- Preflight shows competing SELECT policies (>1) of unknown origin
- Writer policies appear on `public.clubs` unexpectedly
- Forward apply fails mid-transaction (transaction aborts — re-run preflight)
- Post-apply still shows broad club-row `status = 'active'`
- N1/N2 fail (cross-tenant full-row still readable)
- Public catalog RPC EXECUTE revoked or broken
- Club Management RPC smoke fails for legitimate tenant/member paths

## Rollback

If stop conditions hit after forward:

1. Apply `sql/90_CLUBS_RLS_REMEDIATION_01_ROLLBACK.sql` on Staging.
2. Remediating re-apply required after abort.
3. Halt further apply; escalate to Owner.

Rollback classification: `STAGING_ABORT_ONLY` / `PRODUCTION_FORBIDDEN` /
`SECURITY_REGRESSION_IF_APPLIED`.

## Forbidden

- No Production apply
- No Vercel / deploy changes
- No `TRUNCATE` / `DROP TABLE`
- No secret printing
- No package.json / lockfile changes for apply

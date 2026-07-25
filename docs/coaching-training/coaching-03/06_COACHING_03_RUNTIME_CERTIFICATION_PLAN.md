# COACHING-03 — Runtime Certification & Fixture Plan

**Status:** Plan only — fixtures not created; runtime not cut over.

## Runtime certification plan

1. Keep `COACHING_DURABLE_RUNTIME_DEFAULT = false`.
2. Inject Staging Supabase client into `createDurableCoachingRepositories` in **test harness only**.
3. Certify tenant/club scoped reads, conflict mapping, typed errors, deterministic ordering using **admin principals only** (`SUPER_ADMIN`, `TENANT_OWNER`/`VENUE_OWNER`, `VENUE_MANAGER`, `CLUB_MANAGER`).
4. Negative authz: COACH without permission denied; PLAYER without permission denied; wrong tenant/club denied; anon denied.
5. **No positive COACH flow** in COACHING-03 (assignment-aware RLS deferred to COACHING-04).
6. Assert durable modules do not import legacy localStorage service as SoT.
7. Assert UI / routes / navigation unchanged.
8. No Production client.

## Fixture plan (Gate E/F — not created now)

| Rule | Value |
|------|-------|
| Prefix | `COACHING_03_CERT_FIXTURE_` |
| Tenant / club | Dedicated Staging cert context only |
| Real user data | Do not modify |
| Existing business records | Avoid unless required |
| IDs | Deterministic or captured then recorded in sanitized evidence |
| Creation order | programs → curricula/lessons → coaches/relationships → enrollments → packages/entitlements → sessions → attendance → evaluations |
| Cleanup order | Reverse mutable children first; preserve append-only history rows created under prefix if design requires soft-retain — otherwise delete prefix-scoped mutable + verify history residual policy |
| Cleanup | Idempotent |
| Residual rows | Must equal 0 for prefix-scoped mutable fixtures |
| Residual role grants | No leftover cert-only grants |
| Auth users | Do not create unless absolutely required; prefer existing sanitized QA labels |
| Shared QA principals | Never delete |

## Cleanup script

```bash
node scripts/coaching/coaching-03-staging-cleanup.mjs
```

Default: dry-run / refuse destructive cleanup without explicit future Owner flags (not granted in this step).

## Evidence

Sanitized labels only — never commit email/password. No password reset in preflight.

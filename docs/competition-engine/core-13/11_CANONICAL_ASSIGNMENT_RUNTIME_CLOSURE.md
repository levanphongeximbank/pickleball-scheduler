# CORE-13 — Canonical Assignment Runtime Closure

**Status:** Trusted-server execution boundary authored · Staging SQL PRECHECK/APPLY/VERIFY **PASS** · Staging Edge `competition-referee-assignment` **DEPLOYED** (`verify_jwt=true`) · disposable fixture provisioner **adopted PR #448 Shared Referee initializer** (`refereeV5EdgeInitializeExecution`) · HISTORICAL_BLOCKER=`INTERNAL_MATCH_LIVE_SHELL` **CLOSED_BY_PR448** · Team/Daily **DENIED** as INTERNAL execution authority · Organizer vs Referee auth contexts **separated** · EXISTING_QA_IDENTITY_MODE **bound in source** · remote CLI execution path **implemented, not run against Staging** · remote fixture provisioning **NOT RUN** · 29-case harness **hardened locally, not executed**
**Package:** `docs/v5/migrations/core13-canonical-assignment-runtime-closure-01/`  
**Edge:** `supabase/functions/competition-referee-assignment/`  
**Harness:** `scripts/core13/core13-trusted-server-staging-acceptance.mjs` (proofs: `scripts/core13/core13-staging-acceptance-proofs.mjs`)
**Fixture provisioner:** `scripts/core13/core13-staging-fixture-provisioner.mjs` (receipt: `scripts/core13/core13-staging-fixture-receipt.mjs`)
**QA auth helper:** `scripts/core13/core13-staging-qa-auth.mjs`
**Date:** 2026-08-18

---

## Ownership

| Concern | Owner |
|---------|-------|
| Assignment **decisions** | **CORE-13** (same runtime on trusted server) |
| Authoritative execution | Competition Edge Function `competition-referee-assignment` |
| Shared command orchestration | `createCompetitionRefereeAssignmentCommandService` |
| Durable assignment rows | `public.referee_assignments` |
| Durable audit + idempotency | This SQL package |
| Persistence adapter | `createRpcCanonicalAssignmentPersistence` (translation only) |
| Generic competition audit adapter | **Adapter #16** — **NOT modified** |
| Contract #08 / Adapter B | Frozen; trusted server reuses Adapter B for match schedule/court context |
| Referee identity | Contract #01 `resolveSubjectIdentity` → Identity-backed RefereeDirectoryPort |
| Qualification / availability | Honest `NOT_CONFIGURED` unless a requirement profile requires them (then fail closed) |

CORE-13 remains decision authority. SQL persistence RPCs execute validated commands only.

Browser CORE-13 is **pre-validation only**. Client-side CORE-13 is **not** authoritative execution proof.

---

## Target topology

```
Browser / Competition Experience
        ↓
authenticated Competition assignment server endpoint
        ↓
canonical actor / tenant / tournament authz
        ↓
Contract #01 resolveSubjectIdentity
        ↓
Contract #08 Adapter B evidence
        ↓
SERVER-SIDE CORE-13 (same source, esbuild bundle)
        ↓
shared assignment command
        ↓
service-role persistence adapter
        ↓
competition_* SQL RPC
        ↓
referee_assignments + audit + idempotency
```

## Actor provenance

`auth.uid()` under `service_role` is not the originating user (proven conflict).

The Edge Function authenticates the user JWT on a user-scoped client and sets
`p_actor_id` from `auth.getUser().id`. Browser `actorId` is stripped.

This is trustworthy because:

- `authenticated` / `anon` / `PUBLIC` cannot EXECUTE the mutation RPCs
- only the trusted server holds the service-role key
- the service-role key is not in the Vite browser bundle

## RPC grants

| Grantee | EXECUTE |
|---------|---------|
| anon | DENY |
| PUBLIC | DENY |
| authenticated | DENY |
| service_role | ALLOW |

## Product write path (post-cutover)

| Mode | Authoritative mutation |
|------|------------------------|
| Internal | `competition-referee-assignment` |
| Official/Open | `competition-referee-assignment` |
| Team | `competition-referee-assignment` (Team RPC compatibility remains, not authority) |
| Daily Play (referee enabled) | `competition-referee-assignment` |

Interim blob assignment is **projection-only**, not authority.

## Remote fixture execution bindings (source-only)

EXISTING_QA_IDENTITY_MODE reuses established Staging QA identities. It does **not** create tenants, Auth users, or identity mutations.

| Token class | Allowed fixture commands |
|-------------|--------------------------|
| ORGANIZER | Tournament writers, `initializeMatchExecution`, CORE-13 `bootstrapRefereeAssignment` |
| REFEREE | Referee V5 get-state / START / SCORE / PAUSE / DECLARE_FORFEIT / FINALIZE **after** an active CORE-13 assignment |

Completed MATCH evidence is `refereeV5EdgeFinalize` after a legal engine sequence (`START_MATCH` then `DECLARE_FORFEIT`). `forceComplete=false`. Tournament status is not MATCH completed proof.

Live-backed fixtures retain `match_live_states` / `match_sync_mutations` / initializer idempotency. `RETAINED_FIXTURE_CLEANUP_GAP=SEPARATE_WORKSTREAM`.

## Fixture schedule planner (harness only)

`scripts/core13/core13-staging-fixture-schedule-planner.mjs` is **test orchestration**. It is not a schedule authority.

- Positive fixture cases receive mutually non-overlapping canonical windows derived from authoritative blocking intervals plus in-plan reservations.
- `FIXED_SHARED_08_00_09_00_WINDOW_FOR_POSITIVE_CASES=DENY`
- The explicit overlap-negative case (`overlapB`) intentionally overlaps `overlapA`.
- Canonical capacity guard remains `CORRECT` / `CAPACITY_CHECK_BYPASS=DENY`.

## Daily athlete eligibility (fixture harness)

`scripts/core13/core13-staging-daily-eligibility.mjs` resolves fixture Daily athletes via the same authority as check-in/createMatches: `daily_play_athlete_eligible_for_club`.

- `CLUB_DATA_V3_AS_PLAYER_SSOT=DENY`
- `PLAYER_ELIGIBILITY_BYPASS=DENY`
- `DUPLICATED_JS_ELIGIBILITY_RULE=DENY`
- Preflight requires `canonicalEligibilityVerified=YES` before tournament materialization.

## Execution gate

Do **not** apply SQL or deploy the Edge Function until Owner GO.

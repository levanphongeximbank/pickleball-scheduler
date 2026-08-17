# CORE-13 — Canonical Assignment Runtime Closure

**Status:** Trusted-server execution boundary authored · Staging SQL PRECHECK/APPLY/VERIFY **PASS** · Staging Edge `competition-referee-assignment` **DEPLOYED** (`verify_jwt=true`) · disposable fixture provisioner foundation **HARDENED LOCAL ONLY** · Team RPC **DENIED** as INTERNAL match authority · `INTERNAL_MATCH_LIVE_SHELL` writer gap **reported** · remote fixture provisioning **NOT RUN** · 29-case harness **hardened locally, not executed**
**Package:** `docs/v5/migrations/core13-canonical-assignment-runtime-closure-01/`  
**Edge:** `supabase/functions/competition-referee-assignment/`  
**Harness:** `scripts/core13/core13-trusted-server-staging-acceptance.mjs` (proofs: `scripts/core13/core13-staging-acceptance-proofs.mjs`)
**Fixture provisioner:** `scripts/core13/core13-staging-fixture-provisioner.mjs` (receipt: `scripts/core13/core13-staging-fixture-receipt.mjs`)
**Date:** 2026-08-17

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

## Execution gate

Do **not** apply SQL or deploy the Edge Function until Owner GO.

# CORE-13 — Canonical Assignment Runtime Closure

**Status:** Trusted-server execution boundary authored · SQL **not executed** · Edge Function **not deployed**  
**Package:** `docs/v5/migrations/core13-canonical-assignment-runtime-closure-01/`  
**Edge:** `supabase/functions/competition-referee-assignment/`  
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
| Contract #08 / Adapter B | Unchanged; server consumes canonical Referee evidence |

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

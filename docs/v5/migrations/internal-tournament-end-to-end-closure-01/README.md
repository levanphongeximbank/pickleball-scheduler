# internal-tournament-end-to-end-closure-01

**Workstream:** `INTERNAL-TOURNAMENT-END-TO-END-CLOSURE-01`
**Status:** LOCAL PACKAGE ONLY — **do not apply** until Owner GO (`STAGING_MUTATIONS=0`).

## Contract (Pass 2.6 corrective)

| Field | Meaning |
|-------|---------|
| `canonical_tournaments.version` | Server-owned monotonic bigint (starts at 1) |
| Internal `expected_version` | **REQUIRED**. Missing/invalid → `VERSION_REQUIRED`, **zero mutation** |
| Internal stale token | `VERSION_CONFLICT`, **zero mutation** |
| Non-Internal omit token | Backward-compatible for Team / other modes |
| `force_status_reopen` | `true` allows Internal `completed → active` only |
| Internal completion | Competition from **existing** payload (`completed`/`forfeit` only — lock ≠ complete); close snapshot from merged payload |

### Internal legal transitions (edge)

- `draft` → `registration` \| `ready` \| `cancelled`
- `registration` → `ready` \| `draft` \| `cancelled`
- `ready` → `active` \| `completed` \| `registration` \| `cancelled`
- `active` → `completed` \| `cancelled`
- `completed` → ∅ (unless force reopen → `active`)
- `cancelled` → `draft`

Edge legal **and** business prerequisites must both pass for `→ completed`.

Team Tournament modes are **not** constrained by this graph and may omit CAS.

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Require canonical table + update/create RPCs |
| `02_APPLY.sql` | version + Internal CAS mandatory + completion gate + force reopen |
| `03_VERIFY.sql` | Structural proof (VERSION_REQUIRED / completion helper / grants) |
| `04_ROLLBACK.sql` | Restore cutover-01 create/update; drop helpers + version |

## Safety

- RPC signature unchanged: `canonical_tournament_update(text,text,uuid,jsonb)`
- Anon execute revoked
- Tenant assert unchanged
- No Production / Staging apply in this pass

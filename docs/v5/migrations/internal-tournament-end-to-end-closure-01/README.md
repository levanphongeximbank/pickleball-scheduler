# internal-tournament-end-to-end-closure-01

**Workstream:** `INTERNAL-TOURNAMENT-END-TO-END-CLOSURE-01`
**Status:** 01–04 live on Staging. Additive IT-E2E-BROWSER-016 referee runtime package: 05–08. **STAGING ONLY.**

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
| `05_REFEREE_RUNTIME_PRECHECK.sql` | IT-E2E-BROWSER-016: live table + referee RPCs; Internal ensure absent |
| `06_REFEREE_RUNTIME_APPLY.sql` | `canonical_ensure_internal_referee_match_live(text)` + match uniqueness |
| `07_REFEREE_RUNTIME_VERIFY.sql` | Invalid/unassigned/cross-tenant denied; Owner ensure idempotent; score preserve |
| `08_REFEREE_RUNTIME_ROLLBACK.sql` | Drop Internal ensure RPC + match uniqueness index |

## Safety

- RPC signature unchanged: `canonical_tournament_update(text,text,uuid,jsonb)`
- Anon execute revoked
- Tenant assert unchanged
- 05–08: STAGING ONLY (`qyewbxjsiiyufanzcjcq`). No Production apply.

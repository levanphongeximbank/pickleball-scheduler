# COMMS-ACT-05 — Gate C identity/data readiness (read-only)

**Recorded:** 2026-07-25  
**Target:** `qyewbxjsiiyufanzcjcq`  
**Production:** `expuvcohlcjzvrrauvud` UNTOUCHED  
**Mutation count:** `0`  
**Verdict:** `COMMS_ACT_05_READY_FOR_STAGING_SMOKE_OWNER_GO`

Script: `scripts/communication/comms-act-05-gate-c-identity-inventory.mjs`  
Gate B backup: `...\qyewbxjsiiyufanzcjcq-20260725-151823-COMMS-ACT-05`  
ZIP SHA256: `e7c5abaede26aac4bb351d0cb6749e5fd407f48b72c17a993948e9aab645450f`

## Inventory counts (no PII)

| Asset | Count |
|-------|------:|
| Active profiles (sample/query) | 87 |
| Active `club_members` | 79 |
| Inactive/removed `club_members` | 7 |
| Clubs (sample) | 22 |
| Active governance assignments | 37 |
| Distinct active clubs | 22 |
| Distinct tenants with members | 2 |
| `communication_conversations` | **0** |
| `communication_messages` | **0** |
| `communication_conversation_participants` | **0** |
| `COMMS_ACT_05_SMOKE_FIXTURE_` markers | **0** |
| `COMMS_ACT_04_CERT_FIXTURE_` markers | **0** |
| `communication_idempotency` rows | **0** (table reachable) |

## Role coverage (aliases only)

| Role | Ready | Alias |
|------|:----:|-------|
| Direct A | YES | `DA_de2f6520` |
| Direct B | YES | `DB_b50df1da` |
| Unrelated Direct user | YES | `UN_36e4c5c3` |
| Club A active regular | YES | `CAR_de2f6520` |
| Club A owner/manager | YES | `CAM_b50df1da` (`club_owner` + `president`) |
| Club A inactive/removed | YES | `CAI_603f1dfb` (`removed`) |
| Club B active member | YES | `CBA_ad15cc5d` |
| Same-tenant non-member | YES | `STN_36e4c5c3` |
| System producer | YES* | harness injects `COMMS_SYSTEM_PRODUCER_KEY` at smoke time (not in browser) |

\* Key not preconfigured in current shell env; required only when Owner GO smoke runs.

## Smoke matrix readiness

All required positive/negative cases map to existing identities or fail-closed code paths: **YES**.

Temporary Communication-only rows (marker `COMMS_ACT_05_SMOKE_FIXTURE_`) may be created **after** Owner GO via trusted backend — no auth user create, no membership mutation.

## Safety probes

| Check | Result |
|-------|--------|
| Anon write `communication_messages` | DENIED (`401`) · mutation 0 |
| Realtime publication | `0` (ACT-04 final verify; unchanged this gate) |
| Community | fail-closed |
| Production | untouched |
| ACT-04 backup | untouched |

## Runtime readiness

| Item | Result |
|------|--------|
| Host `api/communication/*` in repo | YES |
| Smoke harness (Node + service-role server-only) | YES |
| Browser HTTP path needs Vercel deploy | Optional for smoke; harness is primary |
| JWT verify dependency | YES (`auth.getUser`) |
| Silent demo fallback | NO |
| Idempotency ledger table | Reachable |

## Non-actions

- No user create
- No membership change
- No Communication insert/update/delete
- No smoke
- No Owner GO consumed
- No Production query

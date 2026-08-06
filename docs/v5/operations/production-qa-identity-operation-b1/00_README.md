# Operation B1 — Reversible QA Identity Quarantine

**Status:** PACKAGE ONLY — NOT EXECUTED  
**Production GO:** NO  
**Production project (expected):** `expuvcohlcjzvrrauvud`  
**Preflight authority:** `OPERATION_B_QA_IDENTITY_PREFLIGHT_COMPLETE_OWNER_DECISION_REQUIRED`

## Scope

Quarantine **exactly eight** Production identities classified:

`SAFE_FOR_REVERSIBLE_QUARANTINE` (preflight labels **QA-04 … QA-11**)

using existing canonical reversible mechanisms only:

1. `public.profiles.status = 'quarantined'`
2. Auth admin ban (`ban_duration = 876000h`) via the same pattern as `scripts/lib/prod-smoke-identity-hygiene.mjs`

No hard delete. No schema change. No new status column.

## Explicit exclusions (Operation B2 / non-QA)

| Identity | Reason | Package action |
|----------|--------|----------------|
| QA-01 | active `tenant_staff` | **Excluded** |
| QA-02 | athlete + removed membership | **Excluded** |
| QA-03 | athlete + removed membership | **Excluded** |
| `phase1b-smith@gmail.com` | real-user lookalike | **Rejected** |
| Any non-certified email | canonical predicate fail | **Rejected** |

## File map

| File | Role |
|------|------|
| `00_README.md` | this file |
| `01_OPERATOR_RUNBOOK.md` | future operator procedure |
| `02_PREFLIGHT.md` | future SELECT-only + allowlist generation |
| `03_EXECUTION.md` | future authorized execute order |
| `04_POSTCHECK.md` | future postcheck |
| `05_ROLLBACK_UNQUARANTINE.md` | future rollback |
| `06_RISK_AND_RECOVERY.md` | recovery requirements |
| `evidence/` | sanitized package evidence |
| `scripts/operations/production-qa-identity-operation-b1/` | package scripts |

## External allowlist (required; not in Git)

Future path:

`C:\Users\Le Phong\Documents\PICK_VN-Secure-Backups\Operation-B1\`

Generated only by a future live SELECT-only capture. Never commit allowlist contents.

## Authorization (future mutation)

Requires **all** of:

- `PRODUCTION_PROJECT_REF=expuvcohlcjzvrrauvud`
- `OPERATION_B1_BATCH_ID=<uuid>`
- `ALLOWLIST_PATH=<protected file>`
- `ALLOWLIST_SHA256=<sha256>`
- `OWNER_PRODUCTION_GO=APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY`
- `EXPLICIT_EXECUTE_CONFIRMATION=I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY`
- `DRY_RUN=false`

Dry-run is the default. Missing/invalid authorization ⇒ **zero mutation calls**.

## Related canonical code

- `src/features/player/utils/qaTestIdentityFilter.js` — `isCertifiedQaEmail`
- `scripts/lib/prod-smoke-identity-hygiene.mjs` — email resolve + reversible quarantine primitives

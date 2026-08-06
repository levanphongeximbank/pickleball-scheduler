# 08 — Runner Remediation Plan

**Target:** Future Operation B1B live operator runner (implementation WP4)  
**This document:** Planning only — do not implement in this task  
**Retired B1 write target:** `profiles.status = 'quarantined'`

## Design principles

1. No `profiles.status` mutation for quarantine or unquarantine
2. Dedicated authority writer is the first durable mutation
3. Auth ban follows successful authority write
4. Fail closed; stop on first unresolved live failure
5. Hard delete unavailable
6. Fresh GO / batch / hashes only — never reuse retired B1 artifacts

## No `profiles.status` mutation

Forbidden adapter methods for B1B quarantine path:

- `updateProfileStatus(..., status: 'quarantined')`
- Any compensation that writes status to/from `quarantined`
- Using `suspended` as quarantine substitute

Allowed: **read** `profiles.status` for snapshot and drift checks only.

## Exact dedicated authority writer

Replace profile status writes with:

- `applyQaQuarantine({ profileId, authUserId, batchId, reason, expectedEmail, label, originalProfileStatus, originalAuthBanned })`
- Backed by `qa_quarantine_apply` RPC or equivalent service-role insert preserving invariants

Idempotency: active row same identity+batch → success no-op.

## Auth ban ordering

**Execute order (live):**

1. Capture / confirm original state (profile status, auth ban, email)
2. Re-verify eligibility + allowlist bind
3. **Apply quarantine authority row** (`state=active`)
4. Verify authority row
5. Apply Auth ban if not already banned
6. If Auth ban fails → **compensate by releasing** authority row (not by status rewrite)
7. Stop on first unresolved failure

**Rollback order:**

1. Drift checks
2. Release authority row
3. Unban if this operation applied ban and original was unbanned

## Idempotency

| State | Forward result |
|-------|----------------|
| Already active quarantine + banned as required | `ok`, zero or minimal mutations |
| Active quarantine, ban missing | Apply ban only |
| No quarantine, not banned | Authority then ban |
| Released historically | New active row allowed under new authorization |

## Exact allowlist binding

Each mutation requires:

- `auth_user_id`, `profile_id`, `expected_email` match live rows
- `profile_id = auth_user_id`
- Certified QA email predicate true
- Label in exact-eight set for the batch
- Zero forbidden business refs per eligibility policy
- Not in B2 exclusion labels (QA-01…QA-03) unless a future separate operation says otherwise

## Exact artifact hash binding

Runner must require:

- `ALLOWLIST_PATH` + `ALLOWLIST_SHA256` byte match
- `RECOVERY_SNAPSHOT_PATH` + `SNAPSHOT_SHA256` byte match
- Mismatch → zero mutations

## Exact batch binding

- `OPERATION_B1B_BATCH_ID` (name TBD) must be a **new** UUID
- Reject retired ids including:
  - `b37186cf-e620-4f27-aba3-d7e8750ae7df`
  - `9c9d5fc7-648e-44c6-a959-e62157f7c970`
- Every authority row stores this batch_id

## Project-ref guard

- `PRODUCTION_PROJECT_REF` must equal expected Production ref when mutating Production
- Staging rehearsals must use Staging project ref and refuse Production credentials
- Wrong ref → zero mutations

## Fail-closed gates

All required:

- Fresh Owner GO (new string; not retired B1 GO)
- Explicit execute confirmation string
- `DRY_RUN=false` only when authorized
- Valid batch UUID (non-retired)
- Hash-verified artifacts
- Git head / implementation merge checks per protocol doc
- Adapter surface allowlist (narrow)

Missing any gate ⇒ dry-run or abort with **zero** mutation calls.

## First-write semantics

First durable write = insert/upsert active quarantine authority row.  
If that fails, Auth ban must not run.

## Partial-failure compensation

| Failure | Compensation |
|---------|--------------|
| Authority insert fails | Stop; no Auth ban |
| Authority ok, Auth ban fails | Release authority row; mark compensated |
| Release compensation fails | Abort; escalate; do not touch `profiles.status` |

## Rollback

Separate rollback entrypoint + **separate** rollback Owner GO (never forward GO).  
Batch-scoped release + Auth restore per `05_ROLLBACK_AND_RECOVERY_PLAN.md`.

## Post-execution verification

For each of exact eight:

- Active quarantine row exists (forward) or released (rollback)
- `profiles.status` equals original snapshot
- Auth ban matches intended end state
- No non-target mutations
- Evidence sanitized (masked ids/emails)

## GO consumption and batch retirement

- Successful or attempted live authorization consumes the GO (one-time)
- Batch UUID retired after use (success, partial, or failed live attempt with GO presented)
- Consumed GO/batch recorded in evidence; never reused

## No hard delete

`hardDelete.available = false` remains invariant. Any path exposing delete Auth/profile for this operation is a blocker.

## Mapping from B1A surfaces to B1B

| B1A surface | B1B fate |
|-------------|----------|
| `updateProfileStatus` | Remove from quarantine adapters |
| `banAuthUser` / `unbanAuthUser` | Keep |
| `fetchProfile` / `fetchAuthUser` | Keep |
| `quarantineEngine` status writes | Rewrite to authority writes |
| `REQUIRED_OWNER_PRODUCTION_GO` B1 string | Retired; new B1B GO required |
| Retired batch list | Extend with B1 failed batch id |

## Explicit non-goals for runner remediation

- Retrying Operation B1 as-is
- Extending CHECK to make B1 status writes succeed
- Implementing runner in this planning commit

# Operation B1A — Approved Live Operator Runner

**Package/runner hardening only. Production GO = NO until a fresh exact Owner
authorization is issued after merge.**

This document covers the server/operator live adapter and runners added for
Operation B1. It does not authorize Production execution.

## Scope

| Item | Value |
|------|-------|
| Forward entry | `scripts/operations/production-qa-identity-operation-b1/execute-live-operator.mjs` |
| Rollback entry | `scripts/operations/production-qa-identity-operation-b1/rollback-live-operator.mjs` |
| Adapter factory | `createOperationB1LiveAdapters()` |
| Production project ref | `expuvcohlcjzvrrauvud` |
| Dry-run default | `true` |
| Hard delete | Impossible |
| Previous batch `9c9d5fc7-…` | Retired — not reusable |
| Previous unused Owner GO event | Closed — issue a fresh GO after merge |

## Secure environment preparation

1. Use a **local operator shell** on a protected machine (Node.js). Never browser.
2. Export credentials from a protected operator environment only:

```text
SUPABASE_URL=https://expuvcohlcjzvrrauvud.supabase.co
SUPABASE_SECRET_KEY=<from protected operator vault>
```

Legacy fallback (only if project conventions require):

```text
SUPABASE_SERVICE_ROLE_KEY=<from protected operator vault>
```

3. **Never** paste secret keys into chat, source code, browser DevTools, Git,
   PR descriptions, tickets, or screenshots.
4. **Never** use `VITE_*` variables for operator credentials.
5. **Never** put credentials on the CLI (`--key`, query strings, etc.).
6. After the run, remove secrets from the operator shell:

```powershell
Remove-Item Env:SUPABASE_SECRET_KEY -ErrorAction SilentlyContinue
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
```

## Dry-run (default — no secret key required)

```powershell
$env:PRODUCTION_PROJECT_REF = "expuvcohlcjzvrrauvud"
$env:OPERATION_B1_BATCH_ID = "<fresh-uuid>"
$env:ALLOWLIST_PATH = "<protected-allowlist-path>"
$env:ALLOWLIST_SHA256 = "<sha256>"
$env:SNAPSHOT_PATH = "<protected-snapshot-path>"
$env:SNAPSHOT_SHA256 = "<sha256>"
$env:DRY_RUN = "true"

node scripts/operations/production-qa-identity-operation-b1/execute-live-operator.mjs
```

Expect: `mutationClientConstructed=false`, `mutationCalls=0`.

## Final live preflight (before any Owner GO)

Re-run package preflight + dry-run live operator. Confirm:

- allowlist SHA matches protected file bytes
- recovery snapshot present + SHA matches
- eight SAFE identities only; B2 excluded
- retired batch ID not used
- no Production mutation

## Exact forward execution (only after fresh Owner GO)

Required after merge (do **not** reuse the prior blocked GO event or batch):

```text
OWNER_PRODUCTION_GO=APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY
EXPLICIT_EXECUTE_CONFIRMATION=I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY
DRY_RUN=false
```

Also required:

- fresh UUID batch ID (not retired)
- fresh allowlist + SHA-256 outside Git
- protected original-state snapshot + SHA-256
- Owner risk decision for limited PITR / Auth-profile risk
- final live preflight PASS

Then:

```powershell
$env:DRY_RUN = "false"
$env:OWNER_PRODUCTION_GO = "APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY"
$env:EXPLICIT_EXECUTE_CONFIRMATION = "I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY"
# plus PROJECT_REF, BATCH_ID, ALLOWLIST_*, SNAPSHOT_*, SUPABASE_URL, SUPABASE_SECRET_KEY

node scripts/operations/production-qa-identity-operation-b1/execute-live-operator.mjs
```

Immediate postcheck runs inside the live operator after a successful execute.

## Compensation

Package order: profile quarantine → Auth ban (`876000h`).

If Auth ban fails after profile write, the engine restores the original profile
status. Partial failure stops the batch and returns non-zero.

## Rollback (separate GO — forward GO cannot authorize)

```text
OWNER_PRODUCTION_GO=APPROVE_OPERATION_B1_ROLLBACK_UNQUARANTINE_ONLY
EXPLICIT_EXECUTE_CONFIRMATION=I_UNDERSTAND_THIS_MUTATES_PRODUCTION_QA_ONLY
DRY_RUN=false
```

Use the applied batch ID + protected original-state snapshot SHA. Drift from
expected post-quarantine state aborts that identity and lists it as unresolved.

```powershell
node scripts/operations/production-qa-identity-operation-b1/rollback-live-operator.mjs
```

## Incident stop conditions

Stop immediately and do not retry if:

- any unexpected non-QA identity appears
- business references appear on a target
- Auth email mismatches allowlist
- profile affected-row count ≠ 1
- compensation fails (unresolved state)
- postcheck fails
- credentials appear in logs (treat as secret incident)
- project URL host ≠ `expuvcohlcjzvrrauvud.supabase.co`

## Adapter surface (narrow)

Allowed: Auth get/ban/unban; profiles conditional status update + verify.

Forbidden: `deleteUser`, account recreate, arbitrary SQL, membership/athlete/
tenant_staff/tournament/rating/finance writers, schema/migrations.

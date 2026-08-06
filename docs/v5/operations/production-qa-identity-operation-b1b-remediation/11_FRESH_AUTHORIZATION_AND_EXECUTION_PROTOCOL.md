# 11 — Fresh Authorization and Execution Protocol

## Binding rule

No previous artifact path, artifact hash, batch ID, Owner decision, or GO may authorize future execution.

```text
OLD_OWNER_GO_REUSABLE=NO
OLD_BATCH_REUSABLE=NO
PRODUCTION_GO=NO   # until a NEW exact GO is issued after all prerequisites
EXECUTION_AUTHORIZED=NO
```

Retired forever for reuse:

- Owner GO `APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY`
- Batch `b37186cf-e620-4f27-aba3-d7e8750ae7df`
- Prior unused batch `9c9d5fc7-648e-44c6-a959-e62157f7c970`

## Prerequisites before any future Production mutation

Future Operation B1B (or successor) Production execution requires **all** of the following, in order:

1. **Remediation implementation merged** (schema, RLS/RPC, runtime filters, runner, tests)
2. **Independent review passes** on the merged implementation
3. **Staging apply succeeds**
4. **Staging rollback succeeds**
5. **Staging reapply succeeds**
6. **Staging runtime smoke passes**
7. **Staging exact-scope reversible execution rehearsal passes**
8. **All eleven certified QA identities freshly revalidated** (live SELECT-only on Production; read-only)
9. **New exact-eight classification/allowlist created** (QA-04…QA-11 or freshly justified equivalent set)
10. **New original-state recovery snapshot created**
11. **Both artifact byte SHA-256 values independently verified**
12. **New batch UUID generated** (never a retired id)
13. **New Owner risk decision recorded**
14. **New exact Production GO issued** (new string; one-time)

Additionally at execute time:

- Fresh project-ref check equals expected Production ref
- Fresh Git head check equals the approved implementation commit/tag
- Dry-run default; live only with explicit confirmation string
- One-time authority: GO and batch consumed by the attempt

## Fresh live revalidation (eleven identities)

Revalidation is **read-only** and must not mutate Production. It must re-derive:

- Auth user id, profile id, email
- Certified QA predicate result
- Business reference counts
- Current `profiles.status`
- Current Auth ban state
- Classification: safe exact-eight vs B2/excluded vs rejected

Any classification change vs historical preflight voids old allowlists.

## Fresh exact-eight allowlist

- New file path under secure backup (not the retired B1 path as authority)
- New contents reflecting live revalidation
- New SHA-256
- Exact size and field contract enforced by runner

## Fresh recovery snapshot

- Captures originals **immediately before** live mutate window
- New SHA-256
- Bound to new batch UUID in runner env

## Byte-level SHA-256 verification

Two independent operators (or operator + reviewed script output) confirm:

```text
sha256(allowlist_bytes) == ALLOWLIST_SHA256
sha256(snapshot_bytes) == SNAPSHOT_SHA256
```

Mismatch ⇒ no GO request, no execute.

## New Owner risk decision

Owner records:

- Residual risk after Staging rehearsal
- Blast radius statement (exact-eight only; authority table + Auth ban)
- Confirmation that status CHECK will not be altered
- Confirmation retired GO/batch will not be reused

## New exact Production GO

- Distinct string from all retired GOs
- Forward GO ≠ rollback GO
- Encodes operation id + exact-eight scope
- One-time; recorded consumed in evidence whether success or fail-closed after presentation

## One-time authority

After GO is presented to a live runner (`DRY_RUN=false`):

- Treat GO as consumed
- Treat batch as retired after the run completes or aborts
- Subsequent runs need new GO + new batch even for retry

## Explicit prohibition list

- Do not retry Operation B1
- Do not reuse B1 allowlist/snapshot hashes
- Do not reuse B1 GO or batch
- Do not authorize from this planning document alone
- Do not issue GO in the planning commit

## Minimum env surface for a future live run (illustrative names)

```text
PRODUCTION_PROJECT_REF=<expected>
OPERATION_B1B_BATCH_ID=<new-uuid>
ALLOWLIST_PATH=<secure>
ALLOWLIST_SHA256=<sha256>
RECOVERY_SNAPSHOT_PATH=<secure>
SNAPSHOT_SHA256=<sha256>
OWNER_PRODUCTION_GO=<new-exact-string>
EXPLICIT_EXECUTE_CONFIRMATION=<new-or-updated-confirmation>
DRY_RUN=false
```

Exact string values are **not** issued here.

## End state after successful future execution (not now)

- Eight active quarantine authority rows (or documented idempotent state)
- Auth bans applied as designed
- `profiles.status` still original legal values
- Evidence package complete
- PRODUCTION_GO consumed; new rollback GO required for undo

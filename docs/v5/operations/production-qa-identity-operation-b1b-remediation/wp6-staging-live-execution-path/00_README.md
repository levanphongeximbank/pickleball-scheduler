# OPERATION B1B — WP6 Staging live execution path remediation

**Status:** LOCAL CODE / TEST REMEDIATION ONLY  
**STAGING_APPLY_GO:** NO  
**AUTH_BAN_GO:** NO  
**PRODUCTION_GO:** NO  

## What this adds

1. **Durable one-time authority claim SQL** (authored, not applied):
   - `sql/30_OPERATION_B1B_ONE_TIME_AUTHORITY_CLAIM_FORWARD.sql`
   - `sql/70_OPERATION_B1B_ONE_TIME_AUTHORITY_CLAIM_ROLLBACK.sql`
   - Table `operation_b1b_one_time_authority_claims`
   - RPC `operation_b1b_claim_one_time_live_authority` (atomic first-claim-wins)
   - RPC `operation_b1b_get_one_time_live_authority_claim` (readback)
   - Rollback 70 is fail-closed when claim rows exist (`OPERATION_B1B_AUTHORITY_CLAIM_ROLLBACK_REFUSED_NONEMPTY_STORE`); empty/absent store teardown remains safe
   - Rollback 70 uses an explicit transaction + `LOCK TABLE ... ACCESS EXCLUSIVE` before the empty check so concurrent durable claims cannot TOCTOU-erase committed evidence

2. **JS durable claim adapter:**
   - `scripts/operations/production-qa-identity-operation-b1b/lib/durableAuthorityClaim.js`

3. **Staging-only live harness:**
   - `scripts/operations/production-qa-identity-operation-b1b/stagingLiveExecute.mjs`
   - Hard-binds `staging_rehearsal` + `qyewbxjsiiyufanzcjcq`
   - Rejects Production ref / Production confirmation / env fallback
   - Wires `createOperationB1BAdminClient` → live adapters → durable claimer → `runB1BExecute`

4. **Authority ordering:**
   - Structural auth → snapshot → allowlist/exact-eight → attach UUID-set hash → **then** durable claim → mutations

## Owner GO still required before live

- Separate **Staging schema apply GO** for `30_*` SQL (`NEW_STAGING_SCHEMA_APPLY_REQUIRED=YES`)
- Separate **Auth-ban GO** after fresh package revalidation
- Fresh outside-Git allowlist/snapshot package (do not hardcode current hashes)

## Secrets policy

Claim ledger stores `owner_go_fingerprint` (sha256) only. Never Owner GO plaintext, DB URL, tokens, or service role keys.

## TOCTOU corrective binding

- `SECOND_INDEPENDENT_REREVIEW_BLOCKER=ROLLBACK_CLAIM_TOCTOU_UNSAFE`
- `TOCTOU_CORRECTIVE_IMPLEMENTATION_COMMIT=799b71048de8119d3df01732094bc803fe7b9d9f`
- SQL30 SHA256 `39a9ec0b816d346d99f6bb196df83a4a5310cdbf46b9bcf952901ab0a02826ef` (12988 bytes) — unchanged
- SQL70 SHA256 `a233fe134b5e347ebdf0679706825ab3c383c8a911da7594671230acf0205c33` (3429 bytes)
- `ROLLBACK_LOCKING_MECHANISM=ACCESS EXCLUSIVE` (lock then fresh guard, held through teardown)
- `ROLLBACK_CLAIM_TOCTOU_SAFE=YES`
- Hammer: 24 iterations, `COMMITTED_CLAIM_EVIDENCE_LOST=0`, `DEADLOCK_FOUND=NO`

Machine-readable evidence: `WP6_STAGING_LIVE_EXECUTION_PATH_REMEDIATION_RESULT.json`

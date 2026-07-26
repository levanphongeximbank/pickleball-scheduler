# COACHING-04 — Exact Commit Guard

**Owner GO token:** `COACHING_04_OWNER_GO_APPLY_STAGING` (not granted here)  
**CODEX_DELETE_ALLOWED:** `NO`

## Rules

1. `--expected-commit` must be the **exact full 40-character** git HEAD SHA of the execution commit.
2. `--owner-approved-commit` must equal the same exact HEAD SHA (no ancestor shortcut).
3. Branch names, short SHAs, and descendant/ancestor mismatches are refused.
4. Owner GO is also bound to:
   - exact Staging project ref `qyewbxjsiiyufanzcjcq`
   - exact `combinedManifestHash`
   - exact `aggregateSha256Forward`
5. Commit or hash mismatch stops **before** database connection / before first SQL.
6. PR merge into `main` does **not** grant Staging apply permission.

## Current pins (package authoring)

| Pin | Value |
|-----|-------|
| Staging project | `qyewbxjsiiyufanzcjcq` |
| Production blocklist | `expuvcohlcjzvrrauvud` |
| Aggregate forward SHA256 | `662e70fbb3c76785d7910492284224df6bd04fa6a0ef358231f2ddccbc3386d4` |
| Combined manifest hash | `16cdb19ff57b0e0460610e8a341ca8f2786ff19a067839a80996866f61111eaa` |
| Hash algorithm | `sha256-lf-normalized` |

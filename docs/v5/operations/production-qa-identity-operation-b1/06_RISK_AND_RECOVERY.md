# Operation B1 — Risk and Recovery

## Risk acceptance required before future GO

Owner must explicitly accept limited no-PITR risk for **Auth + profile status** changes on eight QA identities, or wait for additional backup evidence.

Operation A’s four-row gender snapshot is **not** authority for Operation B1.

## Recovery layers

1. Supabase scheduled physical backup (whole-project disaster fallback; not row-granular)
2. External protected allowlist + original-state snapshot (Auth ban flag + profile status)
3. Package rollback/unquarantine script (fail closed on drift)

## Required snapshots before future execute

- Auth ban/disable state for each of 8 IDs
- Profile status for each of 8 IDs
- Reference counts proving still zero
- Allowlist SHA-256
- Operator batch UUID

## Not in scope

- B2 referenced identities
- Schema CHECK / ALTER
- Hard delete
- Finance/tournament data mutation

# COACHING-04 — Staging Execution Pin

**Status:** `AWAITING_OWNER_GO`  
**Classification:** `COACHING_04_STAGING_EXECUTION_READY_AWAITING_OWNER_GO`  
**CODEX_DELETE_ALLOWED:** `NO`  
**Owner GO token:** `COACHING_04_OWNER_GO_APPLY_STAGING` (**not granted**)

## Pins

| Pin | Value |
|-----|-------|
| Target Staging | `qyewbxjsiiyufanzcjcq` |
| PR | [#287](https://github.com/levanphongeximbank/pickleball-scheduler/pull/287) (MERGED) |
| Merge commit | `0c55f0814aeae1c470c65204b72e6dba0aad9f80` |
| Package commit | `f0a69b7fd9382447406ba1a2f41310dd3c94f66a` |
| Aggregate forward SHA256 | `662e70fbb3c76785d7910492284224df6bd04fa6a0ef358231f2ddccbc3386d4` |
| Combined manifest hash | `16cdb19ff57b0e0460610e8a341ca8f2786ff19a067839a80996866f61111eaa` |
| Mapping-row count (live RO) | `0` |
| `databaseWrites` | `0` |
| `sqlApplied` | `false` |
| `runtimeActivated` | `false` |
| `localStorageRetired` | `false` |
| Production | untouched |

## Forward SQL order

1. `10_COACHING_04_ASSIGNMENT_HELPERS.sql`
2. `11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql`
3. `20_COACHING_04_ASSIGNMENT_RLS.sql`
4. `21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql`
5. `30_COACHING_04_SCOPED_RPCS.sql`
6. `40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql`

`99_COACHING_04_VERIFICATION.sql` only after forward success.  
`90_COACHING_04_ROLLBACK.sql` never auto-run.

## Owner GO binding

Owner must grant `COACHING_04_OWNER_GO_APPLY_STAGING` bound to **all** of:

1. Exact full 40-character **execution commit** (this pin commit SHA)
2. Staging project `qyewbxjsiiyufanzcjcq`
3. Aggregate hash `662e70fbb3c76785d7910492284224df6bd04fa6a0ef358231f2ddccbc3386d4`
4. Combined manifest hash `16cdb19ff57b0e0460610e8a341ca8f2786ff19a067839a80996866f61111eaa`

Evidence JSON: [`../evidence/STAGING_EXECUTION_PIN.json`](../evidence/STAGING_EXECUTION_PIN.json)

PR merge / CI green / local PASS / preflight PASS **do not** grant apply permission.

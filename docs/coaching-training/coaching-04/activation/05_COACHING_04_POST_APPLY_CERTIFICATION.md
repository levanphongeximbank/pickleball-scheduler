# COACHING-04 — Final Staging Recertification

**Verdict:** `COACHING_04_STAGING_ACTIVATION_CERTIFIED_RUNTIME_NOT_ACTIVE`  
**Target:** `qyewbxjsiiyufanzcjcq`  
**CODEX_DELETE_ALLOWED:** `NO`

## Pins

| Pin | Value |
|-----|-------|
| PR #287 merge | `0c55f0814aeae1c470c65204b72e6dba0aad9f80` |
| Original execution commit | `c66397df8e48e75f6a6dfe486dd00e76b34c18d0` |
| ACL patch commit | `657bdaf0e738b7fc705a8d1ded1e5039bf1ef898` |
| Aggregate forward SHA256 | `662e70fbb3c76785d7910492284224df6bd04fa6a0ef358231f2ddccbc3386d4` |
| Combined manifest hash | `16cdb19ff57b0e0460610e8a341ca8f2786ff19a067839a80996866f61111eaa` |
| ACL patch SHA256 | `dfb5bdae4479720761c88f443e3fda8d298a51752445b2c52d4e267d4541c0c1` |

## Catalog / ACL (read-only)

- Functions 15/15 · SECURITY DEFINER · fixed `search_path`
- Policies 31 (PLAYER SELECT 13 · COACH assignment 18)
- RLS ENABLE+FORCE on 13 coaching tables
- No `USING/CHECK (true)`
- Helper ACL: anon `0` · service_role `0` · authenticated `12`
- Mutation RPC: authenticated only
- Mapping-row count `0`
- COACH role absent → EXISTS-guarded deferred
- `databaseWritesDuringCertification=0`
- `sqlApplyRerun=false` · `aclPatchRerun=false`
- Runtime / localStorage / Production untouched

Evidence: [`../evidence/FINAL_STAGING_RECERTIFICATION.json`](../evidence/FINAL_STAGING_RECERTIFICATION.json)

Historical blocker certification (pre-ACL patch) remains at [`../evidence/POST_APPLY_CERTIFICATION.json`](../evidence/POST_APPLY_CERTIFICATION.json).

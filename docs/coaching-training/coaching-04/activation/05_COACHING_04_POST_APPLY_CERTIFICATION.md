# COACHING-04 — Post-Apply Certification (BLOCKED)

**Verdict:** `COACHING_04_POST_APPLY_CERTIFICATION_BLOCKED`  
**Target:** `qyewbxjsiiyufanzcjcq`  
**Execution commit:** `c66397df8e48e75f6a6dfe486dd00e76b34c18d0`  
**CODEX_DELETE_ALLOWED:** `NO`  
**databaseWritesDuringCertification:** `0`  
**sqlApplyRerun:** `false`

## Blocker

Twelve `coaching_04_*` helpers retain **EXECUTE** for `anon` and `service_role` after controlled apply.

- Mutation RPCs (`30_*`) correctly revoked (`authenticated` only).
- Helper SQL (`10_*` / `11_*`) only `REVOKE … FROM PUBLIC` + `GRANT … TO authenticated`; no `REVOKE … FROM anon` / `service_role`.
- Observed helper ACL example: `postgres=X,anon=X,authenticated=X,service_role=X`
- Observed mutation ACL example: `postgres=X,authenticated=X`

No database remediation performed.

## Otherwise PASS (catalog)

- 15/15 forward functions, SECURITY DEFINER, fixed `search_path`
- PM-ID-01 helpers present
- 31 policies; PLAYER SELECT-only; no `USING/CHECK (true)`
- RLS enabled+forced on 13 coaching tables
- Permission seeds + PLAYER `coaching.self.read`
- COACH role absent → grants deferred (EXISTS-guarded)
- mapping-row count `0`
- runtime / localStorage / Production untouched

Evidence: [`../evidence/POST_APPLY_CERTIFICATION.json`](../evidence/POST_APPLY_CERTIFICATION.json)

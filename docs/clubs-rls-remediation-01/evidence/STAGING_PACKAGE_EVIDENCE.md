# CLUBS-RLS-REMEDIATION-01 — Staging Certification Evidence

**Verdict:** `CLUBS_RLS_REMEDIATION_STAGING_CERTIFIED_PR_READY`
**Markers:**
- `CLUBS_RLS_REMEDIATION_01_STAGING_CERTIFIED`
- `CLUBS_RLS_REMEDIATION_01_READY_FOR_OWNER_MERGE`

**Generated:** 2026-07-27
**Locked baseline:** `adc43eb3979292a09687cf099404235583f7895e`
**Branch:** `feature/clubs-rls-remediation-01`
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\clubs-rls-remediation-01`
**Exact Staging project ref:** `qyewbxjsiiyufanzcjcq`
**Production project ref:** `expuvcohlcjzvrrauvud` (not touched)

## Safety baseline

| Check | Result |
|-------|--------|
| Worktree path | PASS |
| Branch | PASS |
| Ancestor of locked baseline | PASS |
| TARGET_PROJECT_REF exact Staging | PASS (`qyewbxjsiiyufanzcjcq`) |
| Production DB write | PASS (not attempted) |
| Production migration apply | PASS (not attempted) |
| Vercel / deploy | PASS (not attempted) |
| package.json / lockfile unchanged | PASS |
| Secrets printed | PASS (none) |
| Rollback applied | PASS (not applied) |

## Staging execution

| Step | Result |
|------|--------|
| Preflight | PASS — `public.clubs` exists, RLS on, exactly one SELECT policy `clubs_select`, broad `status='active'` present pre-apply, Phase 42 helpers + catalog present |
| Forward apply | PASS — transactional DROP/CREATE `clubs_select` only |
| Forward re-apply (recursion-safe) | PASS — member path via `phase42_active_club_member_id(id)` |
| Post-apply verify | PASS — broad branch absent; select_policy_count=1; writer_policy_count=0; catalog EXECUTE retained |
| N1–N10 live | PASS (see `STAGING_NEGATIVE_N1_N10.json`) |

## SQL change (Staging)

`clubs_select` USING now:

```sql
deleted_at IS NULL
AND (
  phase42_is_platform_super_admin()
  OR phase42_is_tenant_member(tenant_id)
  OR phase42_active_club_member_id(id) IS NOT NULL
)
```

Removed: broad club-row `OR status = 'active'`.
No writer policies created. No data mutation. Catalog RPC unchanged.

## Machine evidence (no secrets)

- `STAGING_PREFLIGHT_RESULT.json`
- `STAGING_FORWARD_APPLY_RESULT.json`
- `STAGING_POST_APPLY_VERIFY.json`
- `STAGING_NEGATIVE_N1_N10.json`

## Remaining

1. Owner merge of PR (agent must not merge).
2. Separate Production GO package after Owner review (not this workstream).

# Phase 1B — Production Rollout Preflight (READ-ONLY)

**Verdict:** `READY_WITH_WARNINGS` — await Owner GO before any SQL apply or code deploy  
**Generated:** 2026-07-18T15:27:46.570Z  
**Machine-readable:** `PRODUCTION_PREFLIGHT_REPORT.json`  
**Harness:** `node scripts/preflight-phase1b-production-readonly.mjs`  
**Production changes by this preflight:** **NONE**

---

## 1. Production preflight verdict

**READY_WITH_WARNINGS**

- No hard blockers for the proposed SQL order.
- Production already has a **partial / older Phase 1B-shaped RPC surface** that is **missing narrow auth helpers** and **VP clear / canonical VP hydrate**.
- Applying the Staging-proven SQL bundle via `CREATE OR REPLACE` is the correct remediation path — **not** a greenfield install.

---

## 2. Exact Production project ref

`expuvcohlcjzvrrauvud`

Staging `qyewbxjsiiyufanzcjcq` was **not** queried.

---

## 3. Approved code SHA

`959c8067ea756aa32e50b549a97cd4e762786ff7`  
Confirmed equal to `origin/main` at preflight time.

---

## 4. Existing Production RPC inventory

| Function | Present | SECURITY DEFINER | search_path | Notes |
|----------|---------|------------------|------------|-------|
| `club_update` | YES | true | `public` | Uses **bare** `phase42_is_tenant_member` — **not** `phase42_can_update_club` |
| `club_add_member` | YES | true | `public` | Signature matches Phase 1B |
| `club_remove_member` | YES | true | `public` | Signature matches Phase 1B |
| `club_restore_member` | YES | true | `public` | Signature matches Phase 1B |
| `club_assign_vice_president` | YES | true | `public` | Present; narrow helper **missing** |
| `club_clear_vice_president` | **NO** | — | — | Must be created by Phase 1B completion SQL |
| `phase42_can_update_club` | **NO** | — | — | Must be created (update authz gate) |
| `phase42_can_manage_vice_presidents` | **NO** | — | — | Must be created (VP authz gate) |
| `phase42_club_canonical` | YES | true | `public` | **No** `vice_president_user_ids` hydrate yet |
| `club_list_members` | YES | true | `public` | Present (recipients) |
| `phase42_write_audit` | YES | true | `public` | Present |
| `phase42_is_tenant_member` | YES | true | `public` | Present (must not authorize club_update alone after gate) |

---

## 5. Partial-deployment findings

**YES — partial objects already on Production.**

Critical gaps vs merged Phase 1B (`959c806`):

1. `club_update` allows any tenant member (`phase42_is_tenant_member`) → **authz hole until gate SQL**.
2. Missing `phase42_can_update_club` and `phase42_can_manage_vice_presidents`.
3. Missing `club_clear_vice_president`.
4. `phase42_club_canonical` lacks VP array hydrate.
5. Member add/remove/restore RPCs already exist (likely earlier Staging-parity apply) — re-apply is idempotent `CREATE OR REPLACE`.

**Implication:** Production SQL apply remains **mandatory** before deploying the merged client that expects narrow gates + clear-VP + VP hydrate. Do **not** deploy code first.

---

## 6. Audit constraint compatibility

- Constraint `audit_logs_action_check`: **exists**
- Current def already includes: identity actions + `club.update` + `club.member.add/remove/restore` + governance transfers + `club.vice_president.assign`
- Distinct stored actions (10): `assign_role`, `club.leave_membership`, `club.membership_request.*`, `create`, `login`, `password_change`, `reset_password`, `update`
- **Incompatible with additive Phase 1B whitelist:** **0** (additive UNION always preserves history)
- **Would fail fixed 45A.3C IN-list:** **0** on current Production rows (still do **not** use fixed lists)
- Additive apply still required to ensure `club.assign_vice_president` / `club.clear_vice_president` (and other known set members) are accepted even if not yet in the constraint list

---

## 7. Data compatibility findings

| Check | Result |
|-------|--------|
| Clubs | 1 row, status `active`, null `tenant_id` = 0 |
| Members | 36 rows: 34 `active`, 1 `left`, 1 `removed`; null `tenant_id` = 0 |
| Duplicate active `(club_id,user_id)` | **0** |
| Active VP assignments | **0** |
| Clubs with >2 active VPs | **0** |
| Schema `public.clubs` | Compatible (id/tenant_id/name/code/description/status/registered_cluster_id/version present) |
| Schema `public.club_members` | Compatible; uses `membership_type` (no `role_code` column — expected Phase 42 model, not a blocker) |
| Pre-apply data correction | **None required** for SQL apply |

---

## 8. RLS / security findings

- RLS **enabled** on `clubs`, `club_members`, `club_governance_assignments`, `audit_logs`
- Observed policies are primarily **SELECT** (plus audit INSERT); mutations expected via **SECURITY DEFINER** RPCs with `search_path=public`
- **Highest risk today:** live `club_update` authz via bare tenant membership — close with files 2 + 6 in order below before/at SQL apply
- Phase 1B SQL must not weaken RLS; apply scripts must continue to forbid truncate / audit delete

---

## 9. Proposed SQL order (Production)

Safe for observed Production state: **YES** (Staging-proven sequence; additive audit first mandatory; `CREATE OR REPLACE` remediates partial objects).

1. `docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql` — additive audit whitelist  
2. `docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql` — `phase42_can_update_club` + `club_update`  
3. `docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql` — add/remove  
4. `docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql` — restore  
5. `docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql` — VP hydrate + narrow VP helper + assign/clear  
6. `docs/v5/phase1b/PHASE_1B_CLUB_UPDATE_AUTHZ_SECURITY_GATE.sql` — idempotent update authz gate  
7. Catalog verification (SELECT only) — helpers present; `club_update` / VP RPCs use narrow helpers; no bare tenant-member auth on those commands; canonical has VP fields; audit constraint accepts Phase 1B actions  

**Do not** apply a fixed `audit_logs_action_check` IN-list.

---

## 10. Proposed code deployment order

1. Complete SQL steps 1–7 and record verify evidence.  
2. Deploy application from main SHA `959c8067ea756aa32e50b549a97cd4e762786ff7`.  
3. Run Production smoke tests (section 12).  
4. **Do not** start Phase 1C.  
5. **Do not** delete feature branch until Owner confirms post-rollout.

**Never** deploy this client SHA before SQL gates land — client assumes narrow authz + clear-VP + VP hydrate.

---

## 11. Rollback plan

### Database (per file family)

| Step | Rollback approach |
|------|-------------------|
| Additive audit | Leave additive constraint in place; **never** shrink to a non-superset fixed list; **never** delete/truncate `audit_logs` |
| `club_update` / helpers | `CREATE OR REPLACE` prior known-good body only if required; prefer keeping narrow `phase42_can_update_club` once applied |
| Member RPCs | Replace individual function bodies; do not drop tables |
| VP RPCs / canonical | Replace functions; do not drop `club_governance_assignments` |
| Authz gate | Re-apply gate SQL (idempotent) if somehow lost |

**Forbidden:** `DELETE`/`TRUNCATE` on `audit_logs`, `clubs`, `club_members`, `club_governance_assignments`; drop of those tables.

### Code

- Roll app deploy back to the previous Production deployment SHA (pre-`959c806` client cutover) if UI/RPC contract regressions appear.
- Club Storage V2 flag OFF restores documented V1 add/remove fallbacks; restore remains V2-oriented.

### Rollback triggers

- Authz matrix fails (ordinary tenant member can update club / manage VP)
- Audit insert failures (23514) after apply
- Home/Members count divergence after member mutations
- Any unexpected bulk data mutation outside RPC envelopes

---

## 12. Smoke-test plan (Production)

Use a dedicated smoke club; restore name/state after; no truncate.

1. Club profile update (authorized) → persistence + version++ + `club.update` audit  
2. Stale `p_expected_club_version` → `VERSION_CONFLICT`  
3. Ordinary tenant member `club_update` → `FORBIDDEN`  
4. VP assign 1→2; clear one; clear all (`p_member_user_id` null)  
5. Third VP → reject  
6. President-as-VP → reject  
7. Member add → duplicate `ALREADY_MEMBER` → remove → restore  
8. Home `active_member_count` == `club_list_members` active length  
9. Notification recipients: active + non-null `user_id` only  
10. Audits present for update / member add-remove-restore / VP assign-clear  
11. V1 flag-OFF: legacy add/remove still reachable; restore V2-only behavior unchanged  

---

## 13. Blockers and warnings

### Blockers
- **None** for planning / Owner GO on SQL order.

### Warnings (must acknowledge before GO)

1. **Partial Production RPC surface already live** with **unsafe `club_update` authz** (bare tenant member). SQL apply is remediation, not optional.
2. Missing clear-VP helper/RPC and VP canonical hydrate until Phase 1B completion SQL.
3. `club_members.role_code` absent — expected (`membership_type`); not a schema blocker.
4. Production has only **1** club / **36** members — smoke carefully; still treat as live Production.
5. Await explicit Owner **GO** before apply/deploy.

---

## 14. Evidence file paths

- `docs/v5/qa-evidence/phase1b-production/PRODUCTION_PREFLIGHT_REPORT.md` (this file)  
- `docs/v5/qa-evidence/phase1b-production/PRODUCTION_PREFLIGHT_REPORT.json`  
- Harness: `scripts/preflight-phase1b-production-readonly.mjs`

---

## 15. Explicit confirmation

**No Production change was made.**

- No SQL applied  
- No code deployed  
- No Production rows inserted/updated/deleted/truncated  
- Staging was not targeted  
- Feature branch not deleted  
- Phase 1C not started  

**Next step:** Owner GO required to begin Production SQL apply.

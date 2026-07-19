# Notification Phase 2B — Production Safety Remediation

**Phase type:** Remediation only (no Production apply / deploy / worker enable)  
**Date:** 2026-07-19  
**Repository:** `C:\Users\Le Phong\PICK_VN-Workstreams\notification`  
**Branch:** `feature/notification-phase-2b-production-safety-remediation`

---

## 1. Executive verdict

| Question | Answer |
|----------|--------|
| Phase 2A blockers closed? | **Yes** (Production-safe SQL + gates) |
| Safe to apply Staging SQL to Production? | **No** (never — use Production pack only) |
| Production worker / providers enabled? | **No** |
| Phase 2B verdict | **GO FOR PHASE 2C** (Schema Rollout) |
| Recommended Phase 2C | **Option A — Production Schema Rollout** |

**Rationale:** Dedicated Production SQL pack seeds fail-closed (`environment=production`, `allow_worker=false`, `allow_qa_cleanup=false`, providers off, concurrency 0). Apply script defaults to dry-run and refuse live apply without multi-gate Owner approval. Verify script is column-aware and never crashes on missing schema. Rollback preserves Notification data by default and refuses Staging targets. Dual-flag worker gate remains disabled.

---

## 2. Git evidence

| Item | Value |
|------|-------|
| Repository path | `C:\Users\Le Phong\PICK_VN-Workstreams\notification` |
| `origin/main` SHA (branch base) | `15d676a9f80bb4617e64f6f1daae1f2aa8cd005f` |
| Phase 2A merge | PR #78 → `15d676a` (docs commit `7aaf390`) |
| Phase 2A audit present | `docs/NOTIFICATION-PHASE-2A-PRODUCTION-READINESS-AUDIT.md` |
| Working tree at branch creation | clean |
| Sync method | `git pull --ff-only origin main` |

---

## 3. Phase 2A blockers and closure status

| Phase 2A blocker | Closure in 2B |
|------------------|---------------|
| Staging seeds (`allow_worker=true`, `allow_qa_cleanup=true`, `environment=staging`) | Closed — Production pack fail-closed seeds |
| No Production apply script | Closed — `scripts/apply-notification-phase2b-production-sql.mjs` |
| No Production verify script | Closed — `scripts/verify-notification-phase2b-production.mjs` |
| No Production ops CLI | Closed — `scripts/notification-ops-production.mjs` (read-only) |
| Rollback untested for Prod targeting | Closed — Production rollback pack + Staging refuse |
| Operator checklist missing | Closed — `docs/NOTIFICATION-PHASE-2B-REQUIRE-SUPABASE-CHECKLIST.md` |

---

## 4. Production SQL pack

Ordered files (manifest: `docs/supabase-notification-phase2b-production-pack.sql`):

1. `docs/supabase-notification-phase2b-production-13-foundation.sql`
2. `docs/supabase-notification-phase2b-production-13-rpc-hardening.sql`
3. `docs/supabase-notification-phase2b-production-15-delivery-worker.sql`
4. `docs/supabase-notification-phase2b-production-16-ops.sql`
5. `docs/supabase-notification-phase2b-production-runtime-config.sql`
6. `docs/supabase-notification-phase2b-production-security-hardening.sql`

Rollback: `docs/supabase-notification-phase2b-production-rollback.sql`

Generator (deterministic): `scripts/generate-notification-phase2b-production-sql.mjs`

**Never apply:** Staging phase15/16 SQL, `phase13s-qa-profile-bootstrap.sql`.

---

## 5. Apply-script safeguards

`scripts/apply-notification-phase2b-production-sql.mjs`

- Default **dry-run**
- Requires `--apply` + `NOTIFICATION_PHASE2B_PRODUCTION_GO=1` + confirm string + exact Production project ref
- Blocks Staging/QA refs
- Scans SQL for unsafe seeds before apply
- Refuses live apply unless `NOTIFICATION_PHASE2B_ALLOW_LIVE_APPLY=1` (reserved for Phase 2C Owner approval)
- Never prints secrets
- Stops on first error
- Emits evidence summary

**Phase 2B did not execute apply mode against Production.**

---

## 6. Verify-script behavior

`scripts/verify-notification-phase2b-production.mjs`

- Returns `PASS` | `BLOCKED_UNSAFE` | `FAIL`
- Fixture/static mode by default (no live Production query)
- Missing tables/columns/RPCs reported as findings — **no crash**
- Checks runtime fail-closed flags, Staging ref absence, rollback compatibility
- Live mode requires explicit preflight approval flag

---

## 7. Permissions hardening

- SECURITY DEFINER functions forced/verified `SET search_path = public`
- Worker RPCs: revoke `PUBLIC` / `anon` / `authenticated`; grant `service_role`
- Claim requires tenant + namespace when runtime environment is production
- No first-tenant / first-venue fallback (RPC hardening bodies retained)

---

## 8. Tenant / environment hardening

JS dual-flag gate: `src/features/notifications/config/productionSafetyConfig.js`

Production worker requires **all** of:

1. `environment=production`
2. `NOTIFICATION_PRODUCTION_WORKER_ENABLE=true`
3. `NOTIFICATION_PRODUCTION_ROLLOUT_APPROVED=true`
4. tenant + namespace present
5. `worker_concurrency > 0`

Phase 2B keeps concurrency default **0** and enable flags **false**.

Memory + SQL paths: cross-tenant cancel/replay rejected; Staging cleanup cannot target Production jobs; queue health fails closed without tenant on Production.

---

## 9. Rollback design

| Mode | Behavior |
|------|----------|
| Data-preserving (default) | Drop Notification ops/worker RPCs, attempts, runtime_config, worker_runs; **keep** inbox + delivery job rows |
| Destructive | Commented; requires extra Owner confirm — drops inbox/jobs |

Guards refuse Staging environment / Staging project ref. Does not drop `audit_logs`, `profiles`, or other Platform objects.

---

## 10. Operator checklist

`docs/NOTIFICATION-PHASE-2B-REQUIRE-SUPABASE-CHECKLIST.md` — Owner-friendly require-supabase gates.

---

## 11. Ops CLI

`scripts/notification-ops-production.mjs`

Read-only: queue-health, worker-heartbeat, stale-leases, failed-jobs, replay-candidates, cancellations, env-verify, config-verify.

**No enable-worker command in Phase 2B.**

---

## 12. Test matrix

| Suite | Result |
|-------|--------|
| notification-phase-1-1 … 1-6 | **PASS** (122 total with 2B) |
| notification-phase-2b-production-safety | **PASS** (27) |
| apply dry-run | **PASS** |
| verify fixture | **PASS** |
| lint:no-new | **PASS** |
| build | **PASS** |
| SQL static security scan (no Staging seeds / worker=true) | **PASS** |

---

## 13. Remaining blockers

| Item | Status |
|------|--------|
| Production SQL not yet applied | Expected — Phase 2C |
| Owner checklist signatures | Pending Owner |
| Live Production preflight approval | Pending Owner for 2C |
| Worker / provider enable | Intentionally deferred |

---

## 14. Recommendation for Phase 2C

**Option A — Notification Phase 2C — Production Schema Rollout**

Proceed only after Owner checklist is signed, backup confirmed, dry-run + verify PASS, then apply Production pack with live-apply gate under change control. Keep worker and providers disabled after schema rollout.

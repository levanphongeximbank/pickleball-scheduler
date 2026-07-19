# Notification Phase 2A — Production Readiness Audit

**Phase type:** Audit + documentation only  
**Date:** 2026-07-19  
**Repository:** `C:\Users\Le Phong\PICK_VN-Workstreams\notification`  
**Branch:** `feature/notification-phase-2a-production-readiness`

## 1. Executive verdict

| Question | Answer |
|----------|--------|
| Notification Foundation on `main` (PR #75)? | **Yes** — merge `96dc1c145d844d7ddaa1430ac3cfb503b744df80` |
| Staging foundation / worker ops proven? | **Yes** (unit + Staging verify) |
| Safe to apply existing Staging SQL verbatim to Production? | **No** |
| Safe to enable Production worker / live providers now? | **No** |
| Phase 2A overall verdict | **GO WITH CONDITIONS** |
| Recommended Phase 2B | **Option B — Additional Remediation** (Production-safe SQL seeds + apply/rollback gate) |

**Rationale:** Code, grants, and kill-switches are structurally sound for a controlled inbox/queue foundation. Staging SQL seeds (`allow_worker=true`, `allow_qa_cleanup=true`, `environment=staging`, Staging `project_ref`) are **not Production-safe**. There is no Production apply script or Production-config seed pack yet. Therefore Phase 2B must remediate before any Production Schema Rollout (Option A).

**Explicit non-actions in Phase 2A:** no Production SQL, no Production deploy, no worker enable, no live Email/SMS/Zalo/Web Push, no secret creation/rotation, no Competition Engine / other-module ownership changes.

---

## 2. Git evidence

| Item | Value |
|------|-------|
| Repository path | `C:\Users\Le Phong\PICK_VN-Workstreams\notification` |
| `origin/main` / local `main` SHA | `96dc1c145d844d7ddaa1430ac3cfb503b744df80` |
| PR #75 | MERGED — https://github.com/levanphongeximbank/pickleball-scheduler/pull/75 |
| PR #75 merge SHA | `96dc1c145d844d7ddaa1430ac3cfb503b744df80` |
| Phase 1.6 commit present | `aafd99dae5082603bc9fedb7b6f8e088e64e257b` |
| Phase 1.7 commit present | `19d18a1692392bf9f0ac6a17648d123a3e53e1e7` |
| Working tree at branch creation | clean |
| Sync method | `git pull --ff-only origin main` |

---

## 3. Architecture readiness matrix

| # | Capability | Implementation | SQL / runtime | Tests | Production risk | Rollout gate | Verdict |
|---|------------|----------------|---------------|-------|-----------------|--------------|---------|
| 1 | Event envelope | `contracts/notificationEventEnvelope.js`, `notificationEmitService.js`, `domainNotificationAdapter.js` | App contract → `notification_inbox` | `notification-phase-1-1-foundation.test.js` | Low | Catalogue freeze | **READY** |
| 2 | Recipient resolution | `recipients/*` | Hardened create/enqueue tenant checks | `1-2`, `1-3`, `1-4` | Medium (unresolved skips) | Identity directory QA | **READY WITH CONDITION** |
| 3 | Inbox SoT | `notificationInboxService.js`, repos, UI | `notification_inbox` + RLS | `1-3`, `1-3s`, `1-4` | Medium | `supabase` mode + require-supabase on Prod UI | **READY WITH CONDITION** |
| 4 | Tenant / venue isolation | Envelope + resolvers + RPC hardening | `tenant_id`, venue binding | `1-2`, `1-5`, `1-6` | Medium | Apply phase13-rpc-hardening before emit | **READY WITH CONDITION** |
| 5 | Delivery queue | `notificationQueueService.js` | `notification_delivery_jobs` | `1-3`, `1-5` | Low | `live_delivery_enabled=false` | **READY** |
| 6 | Worker claim lifecycle | `notificationDeliveryWorker.js` | `notification_delivery_claim_jobs` | `1-5` | High if mis-enabled | `allow_worker=false` until Stage 5 | **READY WITH CONDITION** |
| 7 | Delivery attempts | Worker + repo | `notification_delivery_attempts` | `1-5` | Low | service_role isolation | **READY** |
| 8 | Retry rules | `deliveryRetryPolicy.js`, `deliveryFailureClassification.js` | statuses + `max_attempts` | `1-5` | Low–medium | Confirm Prod max_attempts | **READY** |
| 9 | Idempotency | `idempotencyKey.js`, `deliveryIdempotency.js` | inbox UNIQUE; active channel unique | `1-1`, `1-5`, `1-6` | Medium (replay generations) | Document partial unique | **READY WITH CONDITION** |
| 10 | Cancellation | `queueOpsService.js` | `notification_delivery_cancel_job` | `1-6` | Medium | `allow_cancel` explicit | **READY WITH CONDITION** |
| 11 | Replay | `queueOpsService.js` | `notification_delivery_replay_job` | `1-6` | Medium | `allow_replay=false` until playbook | **READY WITH CONDITION** |
| 12 | Lease recovery | claim reclaim + ops | `notification_delivery_recover_stale_leases` | `1-5`, `1-6` | Medium | Env assert + confirm | **READY WITH CONDITION** |
| 13 | Worker heartbeat | worker start/heartbeat/complete | `notification_worker_runs` | `1-6` | Low | Stale seconds tuned | **READY** |
| 14 | Queue health | `getNotificationQueueHealth` | `notification_queue_health` | `1-6` | Low | Ops thresholds | **READY** |
| 15 | Worker-run audit | same path | `notification_worker_runs` | `1-6` | Low | Retention policy TBD | **READY WITH CONDITION** |
| 16 | Cleanup operations | QA cleanup RPCs / CLI | `notification_qa_cleanup_*` | `1-5`, `1-6` | **Critical** if Staging seeds on Prod | Prod `allow_qa_cleanup=false`; never phase13s | **BLOCKED** (as Staging SQL defaults) |
| 17 | Safe logging | `safeWorkerLog.js` | `notification_sanitize_reason` | `1-5`, `1-6` | Low | Log sink review | **READY** |
| 18 | Environment isolation | `notificationEnvironments.js` + SQL assert | job `environment` + claim filter | `1-6` | **High** if Staging seeds | Production-safe config seed | **BLOCKED** (verbatim Staging apply) |
| 19 | Rollback SQL | docs `*-rollback.sql` | phase13/15/16 rollbacks | N/A | High if untested on Prod | Clone dry-run + runbook | **READY WITH CONDITION** |
| 20 | Compatibility bridges | `COMPATIBILITY.js`, adapters | legacy mobile preserved | `1-4`–`1-6` | Medium | Compat freeze | **READY WITH CONDITION** |
| 21 | Production kill switch | worker + ops + SQL | `allow_worker`, `production_*_blocked` | `1-5`, `1-6` | Residual if Staging seeds | Fail-closed Prod seeds | **READY WITH CONDITION** (runtime) / **BLOCKED** if Staging seeds applied |
| 22 | Provider boundaries | `sandboxDeliveryAdapters.js` | `live_delivery_enabled` | `1-5` | Medium (legacy providers outside worker) | Keep worker sandbox-only | **READY WITH CONDITION** |

---

## 4. SQL audit

### Forward / rollback pairs

| Forward | Rollback | Notes |
|---------|----------|-------|
| `docs/supabase-notification-phase13.sql` | `docs/supabase-notification-phase13-rollback.sql` | Destructive DROP TABLE |
| `docs/supabase-notification-phase13-rpc-hardening.sql` | *(none)* | Re-apply phase13 create/enqueue bodies |
| `docs/supabase-notification-phase13s-qa-profile-bootstrap.sql` | matching rollback | **Staging QA only — never Production** |
| `docs/supabase-notification-phase15.sql` | `docs/supabase-notification-phase15-rollback.sql` | Staging seeds embedded |
| `docs/supabase-notification-phase16.sql` | `docs/supabase-notification-phase16-rollback.sql` | Restores 3-arg enqueue + unique when safe (Phase 1.7) |

### Mandatory checks (read-only)

| Check | Result |
|-------|--------|
| SECURITY DEFINER `SET search_path = public` | **PASS** |
| Worker claim/complete/attempt/recover/replay/cancel/cleanup_run → `service_role` | **PASS** |
| anon/authenticated cannot claim/complete | **PASS** |
| Environment assert fail-closed | **PASS** (SQL + JS) |
| Tenant mandatory on create/enqueue | **PASS** when hardening applied |
| Claim indexes | **PASS** (`idx_notification_delivery_jobs_claim`, `_env_claim`, `_lease`) |
| Active-channel uniqueness for in-flight jobs | **PASS** (phase16 partial unique) |
| Replay from terminal only; preserves delivery idempotency key | **PASS** |
| Cleanup namespace / env / tenant scoped | **PASS** (Production env blocks QA cleanup) |
| Stale lease recovery only expired leases | **PASS** |
| Rollback does not drop unrelated modules | **PASS** (notification objects only) |
| Staging config seeds safe for Production | **FAIL** — requires Phase 2B remediation |

### Ordered Production SQL apply plan (**DO NOT EXECUTE**)

1. **Stage 0 — Backup** Production project; confirm project ref `expuvcohlcjzvrrauvud`.
2. **Remediate first (Phase 2B)** — Production-safe `notification_runtime_config` seeds + defaults (`environment=production`, `allow_worker=false`, `allow_qa_cleanup=false`, `live_delivery_enabled=false`, Production `project_ref`).
3. Apply `supabase-notification-phase13.sql`.
4. Apply `supabase-notification-phase13-rpc-hardening.sql`.
5. Apply Production-variant phase15 (schema + **fail-closed** seeds). Never paste Staging INSERT as-is.
6. Apply Production-variant phase16 (ops RPCs + **fail-closed** seeds).
7. **Verify** grants, RLS, indexes, health RPC, claim returns `worker_disabled` / `production_execution_blocked`.
8. **Never** apply `phase13s-qa-profile-bootstrap.sql` to Production.
9. **Never** use current `notification:apply:phase15|16` Staging scripts against Production (they hard-block / require Staging ref).

### Backup / restore points

| Point | When |
|-------|------|
| B0 | Before any Notification DDL on Production |
| B1 | After phase13 + hardening |
| B2 | After phase15 |
| B3 | After phase16 |
| Restore | Prefer point-in-time / snapshot restore; then selective SQL rollback 16→15→13 only if schema-only and data loss accepted |

---

## 5. Permissions audit

| Operation | Role | Evidence |
|-----------|------|----------|
| Claim / record attempt / complete | `service_role` only | phase15/16 GRANT + REVOKE PUBLIC |
| Worker run start/heartbeat/complete/abandon | `service_role` only | phase16 |
| Recover leases / replay / cancel / list DLQ / cleanup run namespace | `service_role` only | phase16 |
| Enqueue / inbox create | `authenticated` (tenant-scoped) | phase13+hardening / phase16 |
| Queue health | `service_role` + `authenticated` (admin/tenant scoped) | phase16 |
| Namespaced inbox QA cleanup | `authenticated` scoped | Staging-oriented; blocked when env=production |

**Verdict:** Worker privilege model is Production-capable. **Config seeds are not.**

---

## 6. Environment and tenant isolation review

| Control | Behavior | Verdict |
|---------|----------|---------|
| Worker JS Production hard-block | Blocks Production env/ref unless `allowProductionWorker === true` | PASS |
| SQL `notification_assert_environment_allowed` | Fail-closed; Production blocked unless allow flag | PASS |
| Claim filters `j.environment = v_env` | Staging worker cannot claim Production jobs | PASS |
| Ops CLI | Hard-blocks Production env / Production DB URL | PASS |
| Enqueue Production block (phase16) | `production_enqueue_blocked_phase16` when configured | PASS |
| Tenant on create/enqueue | Required; venue binding via hardening | PASS |
| Tenant default to “first venue” | Not present | PASS |
| Staging SQL seeds on Prod DB | Would mislabel env / enable worker flags | **BLOCKER for verbatim apply** |

---

## 7. Production configuration matrix

| Variable / key | Purpose | Required? | Safe default | Secret? | Owner |
|----------------|---------|-----------|--------------|---------|-------|
| `VITE_SUPABASE_URL` | App Supabase URL | Yes (cloud inbox) | none | No | App / Vercel |
| `VITE_SUPABASE_ANON_KEY` | App anon key | Yes | none | Public-ish | App / Vercel |
| `VITE_SUPABASE_PROJECT_REF` | Worker/project guard | Recommended | empty | No | Worker / App |
| `VITE_NOTIFICATION_STORE_MODE` | Force store mode | Optional | auto | No | App |
| `VITE_NOTIFICATION_REQUIRE_SUPABASE` | Refuse local fallback | **Recommended true on Prod** | unset | No | App |
| `NOTIFICATION_WORKER_ENV` | Worker environment name | Yes (for worker host) | staging *(unsafe for Prod)* | No | Worker host |
| `NOTIFICATION_PROJECT_REF` | Project ref check | Recommended | empty | No | Worker host |
| `SUPABASE_DB_URL` / `DATABASE_URL` | Ops SQL | Ops only | none | **Yes** | Ops |
| `STAGING_*` | Staging verify only | Staging only | n/a | Yes (passwords) | Staging QA |
| `VITE_EMAIL_ENABLED` / SMTP_* | Legacy email path | Optional | `false` / empty | PASS yes | Integrations |
| `VITE_SMS_*` | Legacy SMS | Optional | disabled | Yes | Integrations |
| `VITE_ZALO_OA_*` | Legacy Zalo | Optional | disabled | Yes | Integrations |

### SQL runtime_config keys (not env)

| Key | Production-safe value (target) | Staging seed today |
|-----|--------------------------------|--------------------|
| `environment` | `production` | `staging` |
| `project_ref` | Production ref | Staging ref |
| `allow_worker` | `false` until Stage 5 | `true` |
| `allow_qa_cleanup` | `false` | `true` |
| `live_delivery_enabled` | `false` | `false` |
| `allow_replay` | `false` until playbook | staging policy |
| `allow_cancel` | ops-controlled | staging policy |
| `allow_stale_lease_recovery` | ops-controlled | staging policy |
| `max_replay_count` | low (e.g. 3) | present |
| `worker_heartbeat_stale_seconds` | e.g. 120 | present |

### Worker runtime defaults (code)

| Setting | Safe Production posture |
|---------|-------------------------|
| Batch size | Start ≤ 5 |
| Lease seconds | 60 (cap 300) |
| Concurrency | 1 worker process |
| Polling | Manual / long interval until Stage 7 |
| Kill switch | Omit `allowProductionWorker`; SQL `allow_worker=false` |
| Missing config | Fail-closed (no claim) |

---

## 8. Observability matrix

| Signal | Source | Metric / query | Warning | Critical | Operator response | Exists? |
|--------|--------|----------------|---------|----------|-------------------|---------|
| Queue backlog | `notification_queue_health` | `queued`, `oldestQueuedAgeSeconds` | age > 300s | age > 900s | Inspect enqueue rate; scale worker only after Stage 5 | Yes (RPC) |
| Stuck PROCESSING | health + jobs | `processing`, `expiredLeases` | expired ≥ 1 | rising | Recover stale leases (confirm) | Yes |
| Repeated retries | health | `retryScheduled`, oldest retry age | > 600s | > 1800s | Classify poison jobs | Yes |
| Abandoned workers | `notification_worker_runs` / mark abandoned | `abandonedWorkerRuns` | ≥ 1 / h | ≥ 3 / h | Restart worker; investigate crash | Yes |
| Stale leases | recover RPC / health | `expiredLeases` | ≥ 1 | ≥ 5 | `recover-leases --confirm` | Yes |
| Failed deliveries | health / attempts | `failed` delta | > 5 / 15m | > 25 / 15m | Inspect sanitized errors | Yes |
| Dead letters | `notification_delivery_list_dead_letters` | count | > 0 | > 10 / 15m | Replay only with reason | Yes |
| Replay activity | job `replay_*` columns | audit count | any unexpected | spike | Halt replay allow flag | Partial |
| Cancellation | cancel columns | count | unexpected | spike | Review ops log | Partial |
| Cleanup activity | cleanup RPCs | deleted counts | any on Prod | — | Should be blocked | Yes (blocked in Prod env) |
| Cross-env anomalies | claim errors / env mismatch | `environment_mismatch` | any | any | Stop worker; fix config | Yes |
| Heartbeat loss | worker_runs `heartbeat_at` | stale > threshold | 1× stale | abandoned | Restart / mark abandoned | Yes |

**No external APM connected in Phase 2A.** Operators use SQL RPC + Staging ops CLI patterns (Production CLI must be created in Phase 2B).

---

## 9. Failure and recovery runbook (Owner-safe)

1. **Worker crash** — Stop. Do not restart with Production enable. Check last `notification_worker_runs` row. If leases expired, use recover only after Owner approval.
2. **Database connection loss** — Worker stops claiming. Jobs remain QUEUED/PROCESSING with leases. After DB returns, recover expired leases if needed; do not reset Production flags.
3. **Stale lease** — Confirm job `lease_expires_at` in past and worker abandoned. Run recover with `--confirm` (Staging pattern). Never recover active leases.
4. **Queue backlog** — Check health ages. Prefer pausing emit sources over enabling more workers.
5. **Poison job** — Let it DEAD_LETTER. Do not infinite replay. Capture sanitized error; fix payload; optional single replay with reason.
6. **Duplicate enqueue** — Idempotency should return existing job/inbox. Verify UNIQUE keys; do not delete Production rows casually.
7. **Partial provider failure** — Live providers must remain off. Sandbox/in-app only. Treat live failure as future Phase work.
8. **Incorrect tenant scope** — Stop emit. Confirm `tenantId` / venue binding. Do not broaden worker `tenantId` to null on Production without approval.
9. **Incorrect environment scope** — Stop worker. Fix `NOTIFICATION_WORKER_ENV` / SQL `environment`. Do not claim across envs.
10. **Emergency worker shutdown** — Set SQL `allow_worker=false`. Stop process. Do not pass `allowProductionWorker`.
11. **Rollback after SQL apply** — Restore from backup preferred. SQL rollback order: phase16 → phase15 → (hardening note) → phase13. Accept possible data loss.
12. **Rollback after app deploy** — Redeploy previous app release. Keep SQL `allow_worker=false`. Inbox UI may fall back only if require-supabase is not forced.

---

## 10. Provider readiness boundary

| Channel | Status | Missing | Secrets | Webhook | Retry | Idempotency | Privacy | Order |
|---------|--------|---------|---------|---------|-------|-------------|---------|-------|
| In-app | Sandbox/operational via inbox | — | none | n/a | n/a | inbox + delivery keys | Low | **1 (current)** |
| Web Push | Forced disabled | WebPush adapter + subscriptions wiring | VAPID keys | push service | transient retry | endpoint+payload key | Medium | 2 |
| Email | Sandbox only in worker | Live adapter behind flag | SMTP / API | bounce webhook | transient | message-id | High (PII) | 3 |
| Zalo | Sandbox only | Live OA adapter | OA tokens | OA callbacks | transient | OA msg id | High | 4 |
| SMS | Sandbox only | Live SMS adapter | API key/secret | DLR webhook | transient | provider id | **Critical** (phone) | 5 |

**Do not implement live providers in Phase 2A / 2B schema work.**

---

## 11. Ordered Production rollout plan (**proposal only — not executed**)

### Stage 0 — Backup and readiness
- **Entry:** Phase 2B remediation complete; Owner approval.
- **Actions:** Snapshot Production DB; confirm project ref; freeze live provider flags.
- **Verify:** Backup restore drill documented.
- **Rollback trigger:** Backup failure.
- **Exit:** Owner sign-off on backup ID.
- **Owner approval:** **Yes**

### Stage 1 — Apply Production SQL (worker disabled)
- **Entry:** Stage 0 exit; Production-safe SQL pack ready.
- **Actions:** Apply phase13 → hardening → phase15 → phase16 with fail-closed seeds.
- **Verify:** Tables/RPCs exist; `allow_worker=false`.
- **Rollback trigger:** Grant/RLS anomaly; wrong project.
- **Exit:** Schema verification checklist green.
- **Owner approval:** **Yes**

### Stage 2 — Verify schema / grants / RLS / indexes / health
- **Entry:** Stage 1 complete.
- **Actions:** Read-only probes; attempt claim expects blocked; health RPC works for service_role.
- **Verify:** Checklist signed.
- **Rollback trigger:** Any service_role leakage to anon.
- **Exit:** Security sign-off.
- **Owner approval:** **Yes**

### Stage 3 — Deploy application (worker still disabled)
- **Entry:** Stage 2 exit.
- **Actions:** Deploy app; `VITE_NOTIFICATION_REQUIRE_SUPABASE=true` if cloud inbox enabled; no worker process.
- **Verify:** Header / Notification Center read path; no worker logs.
- **Rollback trigger:** Inbox outage / wrong store mode.
- **Exit:** UI smoke OK.
- **Owner approval:** **Yes**

### Stage 4 — Dry-run / zero-delivery validation
- **Entry:** Stage 3 exit.
- **Actions:** Controlled enqueue of namespaced QA-like rows **only if Prod cleanup policy allows**; otherwise Staging-parity checklist without writes.
- **Verify:** Jobs stay QUEUED; claim still blocked.
- **Rollback trigger:** Unexpected SENT / provider call.
- **Exit:** Zero live delivery confirmed.
- **Owner approval:** **Yes**

### Stage 5 — One controlled worker (strict limits)
- **Entry:** Stage 4 exit; explicit Owner enable.
- **Actions:** Set `allow_worker=true` temporarily; run single worker with batch≤5, concurrency=1, Production allow flag only under change control; prefer in_app only.
- **Verify:** worker_runs heartbeat; limited claims.
- **Rollback trigger:** Error spike / cross-tenant incident → set `allow_worker=false` immediately.
- **Exit:** Stable for agreed window.
- **Owner approval:** **Yes**

### Stage 6 — Validate queue health and audit
- **Entry:** Stage 5 running.
- **Actions:** Compare health metrics to thresholds.
- **Verify:** No abandoned surge; leases healthy.
- **Rollback trigger:** Threshold breach.
- **Exit:** Ops sign-off.
- **Owner approval:** **Yes**

### Stage 7 — Controlled tenant pilot
- **Entry:** Stage 6 exit.
- **Actions:** Scope worker `tenantId` to pilot venue(s).
- **Verify:** Pilot users see inbox; no cross-tenant leakage.
- **Rollback trigger:** Isolation failure.
- **Exit:** Pilot acceptance.
- **Owner approval:** **Yes**

### Stage 8 — Broader Production rollout
- **Entry:** Stage 7 exit.
- **Actions:** Expand tenant scope gradually; keep live providers off.
- **Verify:** Health SLOs.
- **Rollback trigger:** SLO breach.
- **Exit:** Foundation inbox/queue Production GA (providers still off).
- **Owner approval:** **Yes**

---

## 12. Rollback plan

| Layer | Action |
|-------|--------|
| Worker | `allow_worker=false`; stop process; never force-enable |
| App | Redeploy previous release |
| SQL | Prefer backup restore; else phase16 → phase15 → note hardening gap → phase13 |
| Data | Accept retained environment columns; destructive DROP only with backup |
| Providers | Keep all live flags false |

---

## 13. Test results (Phase 2A)

| Suite | Result |
|-------|--------|
| Notification Phase 1.1–1.6 unit (7 files) | **95/95 PASS** |
| Sprint 10 + court-booking | **61/61 PASS** |
| `npm run build` | **PASS** |
| `npm run lint:no-new` | **PASS** |
| Staging `notification:verify:phase14s` | **21/21 PASS** |
| Staging `notification:verify:phase15` | **10/10 PASS** |
| Staging `notification:verify:phase16` | **10/10 PASS** |
| Production credentials used | **No** |
| Production writes | **No** |

---

## 14. Remaining blockers (before Option A Schema Rollout)

1. Staging SQL runtime_config seeds are unsafe for Production (`allow_worker=true`, `allow_qa_cleanup=true`, `environment=staging`).
2. No Production-specific SQL pack / apply script / verify script.
3. phase13-rpc-hardening lacks a dedicated rollback file.
4. Job/attempt column DEFAULT `'staging'` must be overridden for Production.
5. No Production ops CLI (current CLI is Staging-guarded only).
6. `VITE_NOTIFICATION_REQUIRE_SUPABASE` not yet mandated in Production env checklist.
7. Worker-run retention / external alerting not defined.
8. Live providers intentionally blocked (acceptable for inbox foundation; not a schema blocker after remediation).

---

## 15. Recommendation for Phase 2B

**Choose: Option B — Notification Phase 2B — Additional Remediation**

Deliverables for Phase 2B (suggested):

1. Production-safe SQL seed pack (fail-closed flags + Production `project_ref` + `environment=production`).
2. Production apply / verify scripts that refuse Staging refs and refuse enabling worker by default.
3. Hardening rollback note or companion rollback SQL.
4. Production configuration checklist (env + runtime_config).
5. Owner-facing Stage 0–2 runbook dry-run on a clone (optional).

**Only after Phase 2B remediation passes** should Option A (Production Schema Rollout) begin — still with worker disabled through Stage 4.

---

## Production status (Phase 2A)

| Item | Value |
|------|-------|
| Production SQL applied | **false** |
| Production deployment performed | **false** |
| Production worker enabled | **false** |
| Live providers enabled | **false** |

# Notification Phase 1.7 — Foundation Finalization + Remote Sync + PR Readiness

**Target:** Staging evidence only. Production untouched.  
**Branch:** `feature/notification-phase-1-foundation`  
**Phase 1.6 SHA:** `aafd99dae5082603bc9fedb7b6f8e088e64e257b`

## 1. Architecture summary

Notification Foundation (Phase 1.1–1.6) provides:

| Layer | Role |
|-------|------|
| Event envelope + emit | Canonical domain events → inbox rows |
| Recipient resolution | User / role / entry hints with tenant+venue filters |
| Inbox SoT | `public.notification_inbox` (memory/local/supabase repos) |
| Runtime + UI | Bootstrap, Header badge, Notification Center |
| Delivery queue | `notification_delivery_jobs` + attempts |
| Worker | Claim / attempt / complete lifecycle (sandbox / in_app) |
| Ops (1.6) | Env isolation, heartbeat, queue health, cancel/replay/recover/cleanup |

Live Email / SMS / Zalo / Web Push remain disabled. Production worker remains structurally blocked.

## 2. Phase traceability matrix

| Capability | Implementation | Tests | Status |
|------------|----------------|-------|--------|
| Canonical notification model | `contracts/`, `models/inboxNotification.js`, constants | `notification-phase-1-1-foundation.test.js` | IMPLEMENTED |
| Recipient resolution | `recipients/*` | `1-2`, `1-3`, `1-4` | IMPLEMENTED |
| Tenant / venue isolation | Envelope + RLS + claim scope | `1-2`, `1-4`, `1-5`, `1-6` | IMPLEMENTED (venue soft via tenant/role) |
| Inbox source of truth | `notificationInboxService.js`, repos, phase13 SQL | `1-1`, `1-3`, `1-3s`, `1-4` | IMPLEMENTED |
| Runtime provider | `runtime/*`, MainLayout | `1-4` | IMPLEMENTED |
| Notification center UI | `NotificationCenterPage.jsx`, Header | `1-4` | IMPLEMENTED |
| Delivery queue | `notificationQueueService.js`, SQL | `1-3`, `1-5` | IMPLEMENTED |
| Worker claim/complete/attempt | `notificationDeliveryWorker.js`, phase15 SQL | `1-5` | IMPLEMENTED |
| Environment isolation | `notificationEnvironments.js`, phase16 SQL | `1-6` | IMPLEMENTED |
| Heartbeat / worker runs | phase16 SQL + repos + worker | `1-6` | IMPLEMENTED |
| Queue-health aggregation | `queueOpsService.js`, phase16 SQL | `1-6` | IMPLEMENTED |
| Stale lease recovery | `queueOpsService` + phase16 | `1-5`, `1-6` | IMPLEMENTED |
| Cancel behavior | `queueOpsService` + phase16 | `1-6` | IMPLEMENTED |
| Replay behavior | `queueOpsService` + phase16 | `1-6` | IMPLEMENTED |
| Cleanup namespace behavior | QA prefixes + phase16 cleanup RPC | `1-5`, `1-6` | IMPLEMENTED |
| Safe logging / redaction | `utils/safeWorkerLog.js` | `1-5`, `1-6` | IMPLEMENTED |
| Audit trail | worker runs + attempts + cancel/replay metadata | `1-6` | IMPLEMENTED |
| Rollback SQL | phase13/13s/15/16 rollback files | N/A (artifact) | IMPLEMENTED (1.7 restores enqueue + unique) |
| Operational scripts | `scripts/*notification*`, npm `notification:*` | staging verify scripts | IMPLEMENTED |
| Legacy compatibility paths | `COMPATIBILITY.js`, adapters | `1-1`–`1-6` | IMPLEMENTED |

No material foundation gaps remain that block PR review of Phase 1.1–1.6.

## 3. Git evidence

Recorded at Phase 1.7 pre-flight (before 1.7 commit):

| Item | Value |
|------|-------|
| Branch | `feature/notification-phase-1-foundation` |
| HEAD (Phase 1.6) | `aafd99dae5082603bc9fedb7b6f8e088e64e257b` |
| Working tree | clean |
| `origin/main` | `553676e8f91c2f9dfd61837ba69e545815875880` |
| `origin/feature/notification-phase-1-foundation` | `4cf75d134ddea178080924c4599cdb2ff7049161` |
| Merge-base vs `origin/main` | `3650b48b56f189147473c6d5b668dc2d3780371b` |
| Ahead/behind vs origin branch | ahead 1 / behind 0 (Phase 1.6 unpushed) |
| Ahead/behind vs `origin/main` | ahead 10 / behind 59 |

## 4. SQL review

| Check | Result |
|-------|--------|
| SECURITY DEFINER `search_path = public` | PASS |
| Worker RPCs `service_role` only | PASS |
| Env isolation fail-closed | PASS |
| Claim indexes + env predicates | PASS |
| Replay vs delivery idempotency | PASS |
| Cleanup namespace isolation | PASS |
| Production destructive ops | none |
| Rollback vs forward (phase16) | PASS after 1.7 fix (restore 3-arg enqueue + absolute unique when safe) |

SQL files: `docs/supabase-notification-phase13.sql`, `phase13-rpc-hardening.sql`, `phase13s-*`, `phase15.sql`, `phase16.sql` + matching rollbacks.

**Do not apply to Production.**

## 5. Security review

| Check | Result |
|-------|--------|
| Worker claim/complete/recover/replay/cancel/cleanup grants | PASS (`service_role`; scoped QA inbox cleanup for authenticated) |
| Staging cannot claim Production jobs | PASS |
| Tenant filter does not default to first tenant | PASS |
| Safe log redaction | PASS |
| No hard-coded credentials in committed notification paths | PASS |
| Production worker blocked | PASS |
| `.env.staging-qa.local` gitignored | PASS |

## 6. Validation commands and results

| Suite | Command | Result |
|-------|---------|--------|
| Phase 1.1–1.6 unit | `node --test tests/notification-phase-1-*.test.js` (7 files) | **95/95 pass** |
| Sprint 10 + court-booking | `node --test tests/sprint10-integrations.test.js tests/court-booking.test.js` | **61/61 pass** |
| Build | `npm run build` | **PASS** (vite + PWA) |
| Lint gate | `npm run lint:no-new` | **PASS** (0 new violations) |
| Typecheck | N/A | not configured in `package.json` |
| Staging 1.4S | `npm run notification:verify:phase14s` | **21/21 PASS** |
| Staging 1.5 | `npm run notification:verify:phase15` | **10/10 PASS** |
| Staging 1.6 | `npm run notification:verify:phase16` | **10/10 PASS** |

Targeted coverage exercised inside Phase 1.5/1.6 unit suites: cross-environment claim, cross-tenant isolation, duplicate delivery prevention, stale lease recovery, worker heartbeat, cancellation transitions, replay + idempotency, cleanup namespace isolation, safe-log redaction, worker-run terminal/abandoned status.
## 7. Known limitations

- No live Email
- No live SMS
- No live Zalo
- No live Web Push
- Production worker disabled / structurally blocked
- No Production SQL applied
- No Production deployment performed
- Competition Engine internal notifications still blocked pending future boundary-only adapters
- Several legacy paths intentionally retained (see `COMPATIBILITY.js`)

## 8. Production blockers

- Must not enable `allow_worker` / production environment for notification worker
- Must not apply notification SQL to Production until a dedicated Production gate
- Must not enable live provider adapters
- Branch must not be force-merged without PR review

## 9. Rollback references

| Forward | Rollback |
|---------|----------|
| `docs/supabase-notification-phase13.sql` | `docs/supabase-notification-phase13-rollback.sql` |
| `docs/supabase-notification-phase13-rpc-hardening.sql` | re-apply phase13 create/enqueue as needed |
| `docs/supabase-notification-phase13s-qa-profile-bootstrap.sql` | `docs/supabase-notification-phase13s-qa-profile-bootstrap-rollback.sql` |
| `docs/supabase-notification-phase15.sql` | `docs/supabase-notification-phase15-rollback.sql` |
| `docs/supabase-notification-phase16.sql` | `docs/supabase-notification-phase16-rollback.sql` |

## 10. PR readiness verdict

**READY FOR PR** after Phase 1.7 commit + normal push of `feature/notification-phase-1-foundation`, with known limitations above documented.

Recommended PR title:

`feat(notification): Phase 1 foundation (1.1–1.6) + 1.7 readiness`

Do not merge to `main` automatically. Do not deploy Production.

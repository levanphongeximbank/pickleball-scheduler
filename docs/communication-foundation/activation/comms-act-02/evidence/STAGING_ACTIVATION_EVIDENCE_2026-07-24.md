# COMMS-ACT-02 — Staging Activation Evidence

**No secrets.** Tokens, passwords, connection strings, and service-role keys are not recorded.

---

## 1. Meta

| Field | Value |
|-------|-------|
| phase | COMMS-ACT-02 (apply) |
| operator | Agent (evidence + verification) |
| approver (Owner) | Owner SQL Editor apply + final verification |
| date (local) | 2026-07-24 |
| branch | `ops/communication-foundation-comms-act-02-staging-apply` |
| finalVerdict | `GO_STAGING_PERSISTENCE` |

## 2. Target fingerprint

| Field | Value |
|-------|-------|
| environment | staging |
| targetProjectRef | `qyewbxjsiiyufanzcjcq` |
| productionRefConfirmedAbsent | yes (`expuvcohlcjzvrrauvud` blocked) |
| urlHostFingerprint | `qyewbxjsiiyufanzcjcq.supabase.co` (host only) |
| COMMS_STAGING_TARGET_CONFIRM matched | yes |

## 3. Backup evidence

| Field | Value |
|-------|-------|
| backupTimestamp | 2026-07-24 21:17:25+07 |
| targetProjectRef | `qyewbxjsiiyufanzcjcq` |
| backupMechanism | logical export + ZIP archive |
| backupStatus | success (`BACKUP_COMPLETE`) |
| restoreCapability | documented path under PICK_VN-Backups (filesystem verified Gate A) |
| evidenceLocation | `...\pickleball-scheduler-staging-qyewbxjsiiyufanzcjcq-20260724-211725` |
| Gate A evidence | `GATE_A_PREFLIGHT_2026-07-24.md` |

## 4. Preflight output

| Field | Value |
|-------|-------|
| command | `node scripts/communication/comms-act-01-staging-preflight.mjs --offline` / `--live-gates` |
| verdict | `COMMS_ACT_01_READY_FOR_OWNER_GO` |
| forwardSqlSha256 | `74f04eed7fdecbadca0a20d0f57605a921b22974ca9305d1b042a3528deffef3` |
| tableCount (SQL package) | 14 |
| findingsSummary | none |
| Gate A verdict | `COMMS_ACT_02_READY_FOR_STAGING_SQL_EDITOR_APPLY` |

## 5. SQL apply

| Field | Value |
|-------|-------|
| applyOperator | Owner (Supabase SQL Editor) |
| applyMechanism | SQL Editor |
| runCount | 1 |
| sqlSha256Applied | `74f04eed7fdecbadca0a20d0f57605a921b22974ca9305d1b042a3528deffef3` |
| sqlRelativePath | `docs/supabase-communication-comms05.sql` |
| realtimePublicationTouched | **no** |

## 6. Object inventory (post-apply)

| Object class | Expected | Observed | Pass |
|--------------|----------|----------|:----:|
| communication_* tables | 14 | 14 | YES |
| RLS enabled | 14 | 14 | YES |
| deny-all policies | 14 | 14 | YES |
| RPCs (allocate + advance) | 2 | present + anon denied | YES |
| invariant triggers | 2 | 2 | YES |
| supabase_realtime communication_* | 0 | 0 | YES |

Owner marker: `FINAL_VERIFICATION_SUCCESS` / `COMMS_ACT_02_FINAL_VERIFICATION_PASS`
Gate B: `GATE_B_POST_APPLY_2026-07-24.md`

## 7. Negative RLS evidence

| Case | Result | Notes |
|------|--------|-------|
| anon denied | PASS | 14/14 tables + 2 RPCs → `401`/`42501` |
| authenticated direct third-party denied | DEFERRED | membership-mapped client RLS = separate gate |
| wrong-club denied | DEFERRED | Club client RLS remains fail-closed deny-all |
| wrong-tenant denied | DEFERRED | Community client RLS remains fail-closed deny-all |
| suspended club member denied | DEFERRED | covered by deny-all until client RLS open |
| community ban/suspend denied | DEFERRED | covered by deny-all until client RLS open |
| actorId UI override ignored | N/A (app layer; not SQL Editor) | COMMS-07 contract retained |

## 8. Smoke evidence

| Surface | Result | Evidence path |
|---------|--------|---------------|
| Direct | DEFERRED (trusted backend / later gate) | ACT-01 smoke package ready |
| Club | DEFERRED | ACT-01 smoke package ready |
| Community | DEFERRED | ACT-01 smoke package ready |

ACT-02 certifies **deny-all Staging persistence** only — not Club/Community client RLS open, not realtime, not Production.

## 9. Realtime evidence

| Field | Value |
|-------|-------|
| publication enabled | **no** |
| decision | DEFERRED |
| communication_* in `supabase_realtime` | 0 |

## 10. Issues / rollback

| Field | Value |
|-------|-------|
| issues | none |
| rollbackOrDisableAction | none required; restore path = Gate A backup directory |
| productionStillBlocked | **yes** |

## 11. Final verdict

```
overall: GO_STAGING_PERSISTENCE
clientRls: FAIL_CLOSED_DENY_ALL
realtime: NOT_ENABLED
production: BLOCKED
```

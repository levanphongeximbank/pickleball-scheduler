# COMMS-ACT-01 — Staging Evidence Template

**No secrets.** Do not paste tokens, passwords, connection strings, or service-role keys.

Copy to `evidence/STAGING_ACTIVATION_EVIDENCE_<ISO_DATE>.md` when executing COMMS-ACT-02.

---

## 1. Meta

| Field | Value |
|-------|-------|
| phase | COMMS-ACT-02 (apply) / COMMS-ACT-01 (readiness only) |
| operator | |
| approver (Owner) | |
| date (UTC) | |
| branch / commit SHA | |
| finalVerdict | GO / NO-GO / BLOCKED |

## 2. Target fingerprint

| Field | Value |
|-------|-------|
| environment | staging |
| targetProjectRef | qyewbxjsiiyufanzcjcq |
| productionRefConfirmedAbsent | yes / no |
| urlHostFingerprint | `*.supabase.co` host only (no key) |
| dbHostFingerprint | host only (no user/password) |
| appPreviewPointsToStaging | yes / no |
| COMMS_STAGING_TARGET_CONFIRM matched | yes / no |

## 3. Backup evidence

| Field | Value |
|-------|-------|
| backupTimestamp | |
| targetProjectRef | qyewbxjsiiyufanzcjcq |
| backupMechanism | PITR / Dashboard backup / logical export / other |
| backupStatus | success / failed |
| restoreCapability | documented path / drill result |
| retention | |
| confirmedBy | |
| evidenceLocation | |

## 4. Preflight output

| Field | Value |
|-------|-------|
| command | `node scripts/communication/comms-act-01-staging-preflight.mjs --offline` |
| exitCode | |
| verdict | |
| forwardSqlSha256 | |
| tableCount | |
| findingsSummary | |

Attach sanitized JSON (`--json`) without env secret values.

## 5. SQL apply (ACT-02 only)

| Field | Value |
|-------|-------|
| applyOperator | |
| applyTimestamp | |
| applyMechanism | SQL Editor / Management API / other |
| jobOrStatementId | |
| sqlSha256Applied | |
| realtimePublicationTouched | **no** (required) |

## 6. Object inventory (post-apply)

| Object class | Expected | Observed | Pass |
|--------------|----------|----------|------|
| communication_* tables | 14 | | |
| RLS enabled | 14 | | |
| deny-all policies | 14 | | |
| RPCs | 2 | | |
| invariant triggers | 2 | | |
| supabase_realtime communication_* | 0 | | |

## 7. Negative RLS evidence

| Case | Result | Notes |
|------|--------|-------|
| anon denied | | |
| authenticated direct third-party denied | | |
| wrong-club denied | | |
| wrong-tenant denied | | |
| suspended club member denied | | |
| community ban/suspend denied | | |
| actorId UI override ignored | | |

## 8. Smoke evidence

| Surface | Result | Evidence path |
|---------|--------|---------------|
| Direct | | |
| Club | | |
| Community | | |

## 9. Realtime evidence

| Field | Value |
|-------|-------|
| publication enabled | **no** / yes (separate GO only) |
| decision | DEFERRED / ENABLED_WITH_ROLLBACK |
| disableProcedureRehearsed | |

## 10. Issues / rollback

| Field | Value |
|-------|-------|
| issues | |
| rollbackOrDisableAction | none / disable realtime / restore backup / force UNAVAILABLE |
| productionStillBlocked | **yes** (required) |

## 11. Final verdict

```
overall: GO_STAGING_PERSISTENCE | NO_GO | BLOCKED_BACKUP | BLOCKED_TARGET | BLOCKED_RLS | BLOCKED_OTHER
clientRls: FAIL_CLOSED_DENY_ALL
realtime: NOT_ENABLED
production: BLOCKED
```

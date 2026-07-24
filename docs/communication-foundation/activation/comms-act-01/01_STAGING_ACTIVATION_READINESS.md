# COMMS-ACT-01 — Staging Activation Readiness Gate

**Status:** READINESS PACKAGE COMPLETE · **Remote apply NOT EXECUTED**  
**Workstream:** `ops/communication-foundation-comms-act-01-staging-activation-readiness`  
**Owner GO for remote apply:** **NOT GRANTED**

## Purpose

Chuẩn bị toàn bộ preflight, verification, backup gate, RLS/realtime matrices, smoke packages và evidence templates để workstream **COMMS-ACT-02** có thể apply Staging an toàn sau Owner GO.

COMMS-ACT-01 **không**:

- apply SQL remote
- kết nối/mutate Staging hoặc Production
- bật realtime publication
- mở client RLS
- deploy
- thay đổi dữ liệu thật

## Canonical inputs

| Artifact | Path |
|----------|------|
| Forward SQL | `docs/supabase-communication-comms05.sql` |
| Rollback notes | `docs/supabase-communication-comms05-rollback.sql` |
| COMMS-05 design | `docs/communication-foundation/comms-05/05_PERSISTENCE_AND_REALTIME.md` |
| COMMS-07 certification | `docs/communication-foundation/comms-07/07_INTEGRATION_FINAL_CERTIFICATION.md` |
| COMMS-07 runbook | `docs/communication-foundation/comms-07/07_STAGING_ACTIVATION_RUNBOOK.md` |
| Code gates | `src/features/communication/persistence/activationGates.js` |

## Staging target identity

| Env | Project ref |
|-----|-------------|
| **Staging (allowlist)** | `qyewbxjsiiyufanzcjcq` |
| **Production (blocklist)** | `expuvcohlcjzvrrauvud` |

Env names (values never logged):

- `STAGING_SUPABASE_URL` / `VITE_SUPABASE_URL`
- `STAGING_SUPABASE_DB_URL`
- `COMMS_STAGING_TARGET_CONFIRM` (must equal Staging ref)
- `COMMS_STAGING_OWNER_GO`
- `COMMS_STAGING_BACKUP_EVIDENCE`
- `COMMS_STAGING_BACKUP_EVIDENCE_PATH`

Fail-closed: bất kỳ Production ref trong URL/DB URL → **FAIL**. Live remote commands chỉ được xem xét khi target verification **PASS** (COMMS-ACT-02).

## Backup gate

Trước apply bắt buộc evidence:

| Field | Required |
|-------|----------|
| backupTimestamp | yes |
| targetProjectRef | Staging ref only |
| backupMechanism | PITR / Dashboard backup / logical export |
| backupStatus | success |
| restoreCapability | documented |
| retention | documented |
| confirmedBy | Owner/operator |
| evidenceLocation | path under `evidence/` |

Nếu plan không hỗ trợ backup đủ an toàn:

- Verdict **BLOCKED** cho apply
- Không tạo workaround giả
- Không khuyến nghị Production
- Disposable-reset chỉ theo convention platform: **delete/recreate Staging project** (`docs/SUPABASE-STAGING-CHECKLIST.md`) — không ảnh hưởng Production

## SQL apply order (ACT-02, after Owner GO)

1. Preflight offline PASS  
2. Target identity PASS  
3. Backup evidence PASS  
4. Owner GO recorded  
5. Apply `docs/supabase-communication-comms05.sql` (schema → RPC/triggers → deny-all RLS)  
6. **Do not** enable `supabase_realtime`  
7. Post-apply verification + negative RLS + smoke  

Expected: **14** `communication_*` tables, deny-all RLS, 2 RPCs, 2 invariant triggers.

Repeated-run: `IF NOT EXISTS` / `DROP POLICY IF EXISTS` — additive/idempotent for schema objects; not a data migration.

## Scripts (Communication-owned)

| Script | Role |
|--------|------|
| `scripts/communication/comms-act-01-staging-preflight.mjs` | Fail-closed preflight (`--offline` / `--live-gates`); refuses `--apply` |
| `scripts/communication/comms-act-01-post-apply-verify.mjs` | Verification package + checklist; live remote deferred to ACT-02 |

Modules: `src/features/communication/activation/`

```bash
node scripts/communication/comms-act-01-staging-preflight.mjs --offline
node scripts/communication/comms-act-01-post-apply-verify.mjs --offline
```

## Package inventory (this gate)

| Doc | Purpose |
|-----|---------|
| [01_STAGING_PREFLIGHT_CHECKLIST.md](./01_STAGING_PREFLIGHT_CHECKLIST.md) | Operator checklist |
| [01_STAGING_EVIDENCE_TEMPLATE.md](./01_STAGING_EVIDENCE_TEMPLATE.md) | Evidence capture |
| [01_RLS_READINESS_MATRIX.md](./01_RLS_READINESS_MATRIX.md) | Capability verdicts |
| [01_REALTIME_READINESS_MATRIX.md](./01_REALTIME_READINESS_MATRIX.md) | Separate realtime gate |
| [01_SMOKE_DIRECT.md](./01_SMOKE_DIRECT.md) | Direct smoke |
| [01_SMOKE_CLUB.md](./01_SMOKE_CLUB.md) | Club smoke |
| [01_SMOKE_COMMUNITY.md](./01_SMOKE_COMMUNITY.md) | Community smoke |
| [01_NEGATIVE_RLS_PACKAGE.md](./01_NEGATIVE_RLS_PACKAGE.md) | Negative authz |
| [01_BACKUP_GATE.md](./01_BACKUP_GATE.md) | Backup requirements |
| `evidence/` | Filled evidence lives here (no secrets) |

## Readiness verdict (COMMS-ACT-01)

| Gate | Verdict |
|------|---------|
| Structure/code (COMMS-00…07) | COMPLETE |
| Target identity convention | READY (allow/block refs documented + scripted) |
| Backup requirements | READY (evidence template); **evidence not yet captured** → blocks ACT-02 apply |
| SQL static package | PASS |
| Preflight/verify scripts | READY |
| RLS Direct client | READY_BACKEND_TRUSTED_ONLY (deny-all) |
| RLS Club client | BLOCKED_FAIL_CLOSED |
| RLS Community client | BLOCKED_FAIL_CLOSED |
| Smoke packages | READY (checklists; no real data created) |
| Realtime publication | BLOCKED (separate gate) |
| Owner GO remote apply | **NOT GRANTED** |
| **Overall ACT-01 package** | **READY_FOR_OWNER_GO** (open ACT-02 only after Owner GO + backup evidence) |
| **Remote state** | **NOT ACTIVATED** |

## Conditions to open COMMS-ACT-02

1. COMMS-ACT-01 merged or branch available  
2. Owner records `COMMS_STAGING_OWNER_GO`  
3. Backup evidence filled + token set  
4. Target confirm = Staging ref  
5. Preflight `--live-gates` PASS  
6. Operator follows COMMS-07 runbook + this package  

## Explicit non-scope

- No Production apply  
- No client permissive RLS  
- No Notification delivery wiring  
- No package.json / lockfile changes  
- No Club/Player/CRM/Competition SoT edits  

# 04 — Backup, Restore And Recovery Authority

**Workstream:** PGO-02
**Fresh `origin/main`:** `12a559c1214e980e2f734ef70f308e87b3a66df7`
**Snapshot timestamp:** `2026-07-25T21:00:26+07:00`
**Rule:** Phân biệt **repository evidence** vs **external-platform assumption**. Không tuyên bố PITR đã bật nếu không có evidence hiện hành. PGO-02 **không** chạy backup/restore.

## 1. Backup ownership

| Backup class | Owner | Ghi chú |
|--------------|-------|---------|
| **Logical backup** (export/dump/CSV/SQL scoped export) | Data Owner + track/module owner thực hiện | Phải có timestamp + scope + retention + confirmer |
| **Platform-managed backup** (repo scripts/checklists/gates) | Platform ops / module ops theo gate doc | Gate ≠ proof backup đã chạy |
| **External-platform backup** (Supabase Dashboard backups / PITR / Vercel not applicable for DB) | External Platform Owner + environment authority | Capability thuộc vendor plan — **không** phải implementation trong git |
| **Module-owned data backups** | Business Module Owner | Ví dụ COMMS/CRM/Rating backup gates — module SSOT cho procedure chi tiết |

## 2. Logical vs platform-managed vs external

| Kind | What it is | Evidence expected |
|------|------------|-------------------|
| Logical | Artifact xuất được lưu/truy xuất độc lập | Path/location ref, checksum/size optional, scope tables/schemas |
| Platform-managed (repo) | Checklist, probe script, gate token **names** | Filled evidence note under module `docs/**/evidence/` |
| External-platform | Vendor scheduled backup / PITR window | Screenshot/ref ID **không chứa secret**; plan tier acknowledgement |

## 3. Backup evidence (minimum fields)

Align với pattern đã có (ví dụ COMMS-ACT-01 Backup Gate):

| Field | Required |
|-------|----------|
| `backupTimestamp` | Yes |
| `targetProjectRef` / environment | Yes (ref id ok; no keys) |
| `backupMechanism` | Yes (logical / dashboard / PITR claim) |
| `backupStatus` | Yes (`success` / `failed` / `not_available`) |
| `restoreCapability` | Yes (documented steps or drill note — **not** executed by PGO-02) |
| `retention` | Yes |
| `confirmedBy` | Yes |
| `evidenceLocation` | Yes |

Nếu `backupStatus = not_available` → không bịa evidence; escalate Data Owner + Owner GO.

## 4. Restore authority

| Environment | Who may authorize restore | Who may execute |
|-------------|---------------------------|-----------------|
| Local / disposable Staging recreate | Module/platform ops per written convention | Designated operator |
| Shared Staging | **Owner GO** + Data Owner | Designated operator |
| Production | **Owner GO** + Data Owner + External Platform Owner (nếu vendor restore) | Designated operator only after GO |

**Cấm:** restore “thử” Production; restore không có backup evidence; restore đồng thời với migration chưa hiểu blast radius.

## 5. Restore testing

- Restore **drill** trên non-prod khi có Owner GO và project disposable/staging phù hợp.
- Ghi `restore-test evidence`: timestamp, source backup id, target env, result, validator.
- Thiếu restore-test evidence → readiness item = gap (xem [08](./08_PRODUCTION_OPERATIONAL_READINESS_CERTIFICATION.md)), **không** tự PASS.

## 6. Recovery evidence

Sau recover/restore:

| Field | Required |
|-------|----------|
| Recovery action class | backup-restore / forward-fix / rollback / vendor |
| Authority chain | names/roles + Owner GO ref |
| Validation results | pass/fail + what was checked |
| Residual risk | factual |
| Follow-ups | tickets/actions |

## 7. Module-owned data

Module recovery procedures (SQL rollback packs, backup checklists, staging gates) **ở lại module docs**. PGO-02 chỉ:

- yêu cầu chúng có owner;
- yêu cầu evidence trước Production;
- cấm coi module recovery failure là mặc định Platform Core defect.

Ví dụ evidence paths (read-only inventory — không execute):

- `docs/communication-foundation/activation/comms-act-01/01_BACKUP_GATE.md`
- `docs/v5/rating-v5/V5-P1_PRODUCTION_BACKUP_CHECKLIST.md`
- `docs/crm/phase-1h-b/03_STAGING_IDENTITY_AND_BACKUP_EVIDENCE.md`
- Module `*-rollback.sql` / `*_ROLLBACK.md` dưới `docs/**`

## 8. Supabase ownership boundary

| Concern | Boundary |
|---------|----------|
| SQL/RLS content in repo | Repository docs — apply = environment authority + Owner GO |
| Live DB backups / PITR | **Supabase external capability** |
| Project plan tier | External — must not be inferred solely from old docs |
| Scoped rollback SQL files | Module/platform **documentation** of rollback intent — execution still needs GO |

### PITR honesty rule

Historical repository evidence (ví dụ Phase 19A / Gate 3 preflight) ghi nhận Production từng ở plan **Free/Nano** với **không PITR/snapshot** tại thời điểm đó.

PGO-02 trạng thái hiện hành:

```text
PITR_STATUS: NOT_ASSUMED_ENABLED
```

- Không tuyên bố PITR đã bật chỉ vì checklist GA có dòng “Backup / PITR đã bật”.
- Muốn claim `ENABLED` cần evidence mới (Owner-confirmed) ngoài suy diễn.
- `DEPLOYMENT_GUIDE.md` đề cập “Restore Supabase backup/PITR” như **hướng dẫn vận hành** — không phải proof PITR active.

## 9. Explicit non-actions in PGO-02

- Không chạy backup.
- Không chạy restore / PITR.
- Không kết nối remote database để kiểm tra backup UI.
- Không nâng plan Supabase.
- Không thay secret để “mở” backup tooling.

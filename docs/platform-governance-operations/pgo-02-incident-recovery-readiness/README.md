# PGO-02 — Platform Incident, Recovery & Operational Readiness Governance

**Workstream:** PGO-02 — PLATFORM INCIDENT, RECOVERY & OPERATIONAL READINESS GOVERNANCE
**Scope:** Documentation only
**Owner GO:** GRANTED (documentation-first)
**Branch:** `feature/pgo-02-incident-recovery-operational-readiness`
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\platform-governance-operations-pgo-02-incident-recovery`
**Fresh `origin/main` (snapshot):** `12a559c1214e980e2f734ef70f308e87b3a66df7`
**Local HEAD (snapshot):** `bad284332b81b69ffeac08e40ccc5b99fb9f9c3d`
**Snapshot timestamp:** `2026-07-25T21:00:26+07:00`
**Relation to PGO-01:** Builds on merged PGO-01 registry under `docs/platform-governance-operations/**` as governance baseline.

## Mục tiêu PGO-02

Xây dựng nền tảng **chính sách, ownership, runbook và certification** cho incident classification, severity, ownership, escalation, communication, backup/restore authority, recovery readiness, RPO/RTO, application/database/deployment rollback, post-incident review, và Production operational readiness certification.

PGO-02 **không** thực thi backup, restore, rollback, deploy, migration, hoặc bất kỳ operational action thật nào.

## Phạm vi incident, recovery và readiness

| Domain | In scope (policy / authority / evidence) | Out of scope (execution) |
|--------|------------------------------------------|--------------------------|
| Incident | Classification, severity, ownership, escalation, communication | Không thay gate để “làm xanh”; không xóa log |
| Backup / restore | Ownership, evidence requirements, restore-test policy | Không chạy backup/restore thật |
| Recovery | RPO/RTO provisional targets, readiness checklist | Không certify Production readiness trong PGO-02 |
| Rollback | Decision matrix + authority | Không chạy deploy/DB/config rollback thật |
| Certification | Checklist + verdict vocabulary | Không tự cấp `PRODUCTION_OPERATIONAL_READINESS_CERTIFIED` |

## Ownership boundary

| Layer | Owner | PGO-02 role |
|-------|--------|-------------|
| PGO-02 docs (`docs/platform-governance-operations/pgo-02-incident-recovery-readiness/**`) | Owner GO + PGO workstream | Incident / recovery / readiness SSOT |
| PGO-01 registry (`docs/platform-governance-operations/*` root files) | Owner GO + PGO | Governance baseline — **read-only** trong PGO-02 |
| Platform Operations | Platform ops / designated operators | Execute only under Owner GO + documented authority |
| Platform Core | Platform Core owner | Module defect ≠ automatic Platform Core incident |
| Competition Engine | Competition owner | Module-owned recovery; not Platform Core failure by default |
| Business modules | Module owners | Module-owned backup/rollback/runbooks remain module-owned |
| External platforms (Supabase, Vercel, GitHub) | External platform + environment authority | Capability ≠ repository-owned implementation |
| Secrets / env values | Secret authority + Owner GO | Names only; never values |
| Notification Production Phase 2C | Notification owner + Owner GO | **`DEFERRED_BY_OWNER`** — không mở lại |

## Quan hệ với PGO-01

- PGO-01 cung cấp: worktree registry, collision map, rollout/deferred register, environment authority, CI/CD vs deploy authority.
- PGO-02 bổ sung: incident response, backup/restore authority, RPO/RTO governance, rollback decision matrix, operational readiness certification model.
- PGO-00 đã ghi gap **“No platform IR / observability / RPO-RTO SSOT”** — PGO-02 là remediation documentation cho gap đó.
- PGO-02 **không** sửa file PGO-01 hiện có; chỉ tạo subtree `pgo-02-incident-recovery-readiness/`.

## Không chứa business rules

PGO-02 không định nghĩa luật giải, Elo, subscription SKU, pairing rules, billing logic, notification delivery policy, hay schema nghiệp vụ. Chỉ mô tả **cách phân loại sự cố, ai quyết định, bằng chứng nào cần, và khi nào được phép recover**.

## Không thực thi operational action thật

Trong PGO-02 **cấm**:

- Deploy / merge-to-main aiming to deploy
- Migration / SQL / RLS apply
- Backup / restore / PITR execution
- Application / database / deployment rollback execution
- Secret create/rotate/commit
- Worktree reset / clean / stash / force push
- Reopen Notification Production Phase 2C

## Mục lục

| File | Nội dung |
|------|----------|
| [01_INCIDENT_CLASSIFICATION_AND_SEVERITY.md](./01_INCIDENT_CLASSIFICATION_AND_SEVERITY.md) | Severity SEV-0…3, loại incident, thời điểm, evidence |
| [02_INCIDENT_OWNERSHIP_AND_ESCALATION.md](./02_INCIDENT_OWNERSHIP_AND_ESCALATION.md) | Roles, escalation, decision authority, handoff |
| [03_INCIDENT_RESPONSE_RUNBOOK.md](./03_INCIDENT_RESPONSE_RUNBOOK.md) | Detect → close → post-incident; production rules |
| [04_BACKUP_RESTORE_AND_RECOVERY_AUTHORITY.md](./04_BACKUP_RESTORE_AND_RECOVERY_AUTHORITY.md) | Backup/restore ownership và evidence |
| [05_RPO_RTO_AND_SERVICE_CRITICALITY.md](./05_RPO_RTO_AND_SERVICE_CRITICALITY.md) | RPO/RTO provisional targets + Owner approval |
| [06_ROLLBACK_AND_RECOVERY_DECISION_MATRIX.md](./06_ROLLBACK_AND_RECOVERY_DECISION_MATRIX.md) | Rollback / forward-fix decision matrix |
| [07_INCIDENT_COMMUNICATION_AND_POSTMORTEM.md](./07_INCIDENT_COMMUNICATION_AND_POSTMORTEM.md) | Communication + no-blame postmortem |
| [08_PRODUCTION_OPERATIONAL_READINESS_CERTIFICATION.md](./08_PRODUCTION_OPERATIONAL_READINESS_CERTIFICATION.md) | Readiness checklist + verdict vocabulary |
| [09_PGO_02_CERTIFICATION_CHECKLIST.md](./09_PGO_02_CERTIFICATION_CHECKLIST.md) | Path-only / safety certification for this workstream |

## Hard constraints (PGO-02)

- Chỉ tạo/sửa dưới `docs/platform-governance-operations/pgo-02-incident-recovery-readiness/**`.
- Không sửa Platform Core, Competition Engine, business modules, `.github/**`, `scripts/ci/**`, package/lockfiles, Supabase, secrets, deployment config.
- Notification Production Phase 2C = **`DEFERRED_BY_OWNER`**.
- Không tự cấp Production operational readiness certification trong PGO-02.
- Mọi RPO/RTO chưa Owner-approved = **`PROVISIONAL_NOT_CERTIFIED`**.
- Không tuyên bố Supabase PITR đã bật nếu không có evidence hiện hành.

# 03 — Incident Response Runbook

**Workstream:** PGO-02
**Fresh `origin/main`:** `12a559c1214e980e2f734ef70f308e87b3a66df7`
**Snapshot timestamp:** `2026-07-25T21:00:26+07:00`
**Nature:** Policy runbook — **không** chứa lệnh deploy, SQL apply, secret mutation, hoặc exploit steps.

## Sequence overview

```text
detect → acknowledge → classify → contain → assess
  → communicate → recover → validate → close → post-incident review
```

## 1. Detect

- Nguồn: monitoring/alert (nếu có), user report, CI/deploy failure có impact, audit finding, vendor status.
- Ghi `detected_at` + nguồn. Không bỏ qua tín hiệu vì “CI đỏ thường xuyên” nếu có Production impact.

## 2. Acknowledge

- Có người nhận trách nhiệm trong thời gian hợp lý theo SEV ([01](./01_INCIDENT_CLASSIFICATION_AND_SEVERITY.md)).
- Tạo/ghi Incident ID; mở evidence log ([02](./02_INCIDENT_OWNERSHIP_AND_ESCALATION.md)).

## 3. Classify

- Gán severity + type + ownership class.
- Map module P0/P1 templates → SEV nếu escalate platform.
- Nếu chưa chắc giữa SEV-0 và SEV-1: **chọn mức cao hơn** cho đến khi evidence hạ mức.

## 4. Contain

Mục tiêu: dừng lan rộng — chưa nhất thiết recover đầy đủ.

Ví dụ **policy-level** containment (không phải lệnh):

- Ngừng rollout / không merge thêm thay đổi liên quan.
- Disable feature flag **chỉ khi** có authority.
- Cách ly traffic/path bị ảnh hưởng theo runbook module/platform đã tồn tại.
- Thu hồi credential **qua secret authority** — không commit secret mới vào repo.

**Cấm:** xóa log; tắt failing validation để xanh; “hotfix” Production không Owner GO.

## 5. Assess

- Xác định: data impact, tenant impact, security impact, external dependency.
- Chọn hướng: forward-fix / rollback / partial recovery / external recovery — theo [06](./06_ROLLBACK_AND_RECOVERY_DECISION_MATRIX.md).
- Xác định restore có cần không — theo [04](./04_BACKUP_RESTORE_AND_RECOVERY_AUTHORITY.md).

## 6. Communicate

- Theo [07](./07_INCIDENT_COMMUNICATION_AND_POSTMORTEM.md).
- SEV-0/1: Owner update sớm, factual, không suy đoán.
- Không công bố secret, bypass, hoặc blame cá nhân.

## 7. Recover

- Chỉ thực hiện khi authority đủ (Owner GO cho Production).
- Ưu tiên phương án có evidence và rollback path đã hiểu.
- Module-owned recovery do module owner dẫn; external do External Platform Owner dẫn.

PGO-02 **không** chạy recover thật trong workstream này.

## 8. Validate

- Kiểm tra tiêu chí đã ghi trước recover (smoke, tenant isolation checks mức policy, data counts/checksums nếu Data Owner yêu cầu).
- **Không** bỏ qua failing validation.
- **Không** thay Production gate / CI baseline chỉ để incident “xanh”.

## 9. Close

- Confirm recovered + validate + communications complete.
- Ghi `incident_end` và closure approver.
- Mở post-incident review item list.

## 10. Post-incident review

- No-blame; root cause; corrective + prevention actions ([07](./07_INCIDENT_COMMUNICATION_AND_POSTMORTEM.md)).
- SEV-0/1: Owner GO closure approval.

## Hard rules (non-negotiable)

| Rule | Statement |
|------|-----------|
| No greenwashing gates | Không thay Production/CI gate để làm hệ thống xanh trong lúc incident |
| No log deletion | Không xóa hoặc làm mất log/audit cần cho điều tra |
| No skip validation | Không bỏ qua failing validation |
| No secret-in-repo | Không thay/commit secret trong repository |
| No unauthorized rollback | Không chạy rollback khi chưa xác định authority ([06](./06_ROLLBACK_AND_RECOVERY_DECISION_MATRIX.md)) |
| Production needs Owner GO | Mọi Production action yêu cầu **Owner GO** |
| Deferred stays deferred | Notification Production Phase 2C = **`DEFERRED_BY_OWNER`** |

## Environment notes (from PGO-01 baseline)

- GitHub Actions = verification gate — không phải Production deployer ([PGO-01 §05](../05_CI_CD_AND_RELEASE_AUTHORITY.md)).
- Vercel Git Integration = deployment authority trên `main` (repo evidence).
- Staging/Production mutate vẫn theo [PGO-01 §04](../04_ENVIRONMENT_AND_AUTHORITY_MATRIX.md).

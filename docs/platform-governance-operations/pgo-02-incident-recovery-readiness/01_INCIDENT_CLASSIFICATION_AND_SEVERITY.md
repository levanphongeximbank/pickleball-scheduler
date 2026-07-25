# 01 — Incident Classification And Severity

**Workstream:** PGO-02
**Fresh `origin/main`:** `12a559c1214e980e2f734ef70f308e87b3a66df7`
**Snapshot timestamp:** `2026-07-25T21:00:26+07:00`
**Rule:** Phân loại để điều phối phản ứng — **không** mô tả chi tiết kỹ thuật gây hại, exploit, hoặc bypass security.

## 1. Severity model

| Severity | Tên ngắn | Tiêu chí ảnh hưởng (tóm tắt) | Phản ứng mong đợi |
|----------|----------|------------------------------|-------------------|
| **SEV-0** | Catastrophic | Mất dữ liệu đã xác nhận / phá vỡ tenant-isolation đã xác nhận / toàn bộ Production không khả dụng kéo dài / sự cố bảo mật đang diễn ra ảnh hưởng Production | Owner GO ngay; Incident Commander bắt buộc; contain trước recover |
| **SEV-1** | Critical | Production major feature/path không dùng được cho nhiều tenant; degradation nghiêm trọng không có workaround ổn định; rủi ro data integrity cao | Escalate ngay; Technical Lead + domain owner; Owner update trong khung thời gian ngắn |
| **SEV-2** | Major | Degraded service có workaround; ảnh hưởng giới hạn tenant/module; Staging/Preview blocker nghiêm trọng cho release gate | Module/Platform ops lead; escalate nếu lan rộng |
| **SEV-3** | Minor | Ảnh hưởng hẹp, cosmetic/ops hygiene, không chặn Production core path | Ticket / backlog; không cần war-room |

**Ghi chú:** Template QA module (ví dụ TT-9 P0/P1/P2) là **module evidence**, không thay severity platform SEV-0…3. Khi escalate lên platform IR, map sang SEV tương đương và ghi evidence mapping.

## 2. Tiêu chí ảnh hưởng (đánh giá nhanh)

Khi classify, ghi tối thiểu:

1. **Blast radius:** single user / single tenant / multi-tenant / platform-wide.
2. **Data impact:** none / integrity risk / confirmed loss / exposure risk.
3. **Security / isolation:** none / suspected / confirmed.
4. **Availability:** full outage / partial / degraded / none.
5. **Workaround:** none / partial / acceptable.
6. **Environment:** Local / Dev / Test / Staging / Production.
7. **Ownership class:** Platform Core / Business Module / External Platform / Shared CI-deploy surface.

Production + confirmed data-loss hoặc tenant-isolation breach → tối thiểu **SEV-0** cho đến khi chứng minh ngược lại bằng evidence.

## 3. Incident type catalog

| Type | Định nghĩa vận hành | Ownership mặc định |
|------|---------------------|--------------------|
| **Security incident** | Compromise, credential exposure, unauthorized access, abuse of privileged path | Security Owner + Owner GO |
| **Tenant-isolation incident** | Cross-tenant data visibility or mutation beyond authorized boundary | Security Owner + Data Owner + module owner |
| **Data-loss incident** | Confirmed destructive loss or unrecoverable corruption of required records | Data Owner + backup/restore authority |
| **Availability incident** | Service unreachable or primary path fails for intended users | Technical Lead + deployment/external platform owners as applicable |
| **Degraded service** | Partial function, elevated error rate, slow path; core path còn nhưng kém | Technical Lead + module owner |
| **Business-module incident** | Defect localized to a business module (Club, Competition, Finance, Notification, …) | Business Module Owner — **không** mặc định quy là Platform Core |
| **External-platform incident** | Root cause nằm ở Supabase / Vercel / GitHub / identity provider / payment provider | External Platform Owner + environment authority; repo không “sở hữu” vendor runtime |

## 4. Phân biệt module vs platform vs external

| Observation | Correct classification |
|-------------|------------------------|
| Competition Engine scheduling bug trên Staging | Business-module / CE incident — **không** tự gắn Platform Core |
| Shared CI gate đỏ do manifest collision | Shared-surface ops issue; dùng PGO-01 collision map — không phải data-loss |
| Vercel deploy fail / CDN outage | External-platform availability |
| Supabase project unreachable | External-platform availability (+ Data Owner nếu có risk restore) |
| RLS/policy defect gây leak tenant | Security + tenant-isolation (có thể SEV-0/1) |

## 5. Thời điểm bắt đầu và kết thúc incident

| Milestone | Định nghĩa |
|-----------|------------|
| **Detected** | Lần đầu có tín hiệu đáng tin (alert, user report, CI/deploy failure có impact, audit finding) |
| **Acknowledged** | Có người chịu trách nhiệm xác nhận đang xử lý |
| **Incident start (clock)** | Thời điểm impact Production/Staging bắt đầu **hoặc** Detected — chọn cái sớm hơn có evidence; ghi rõ nguồn |
| **Contained** | Blast radius không còn mở rộng theo đánh giá hiện hành |
| **Recovered** | Service/data path khôi phục theo tiêu chí validate đã ghi |
| **Incident end (clock)** | Recovered + validate pass + communications Owner/IC xác nhận đóng pha phản ứng |
| **Closed** | Post-incident actions đã assign; closure approval theo [07](./07_INCIDENT_COMMUNICATION_AND_POSTMORTEM.md) |

Không “đóng sớm” bằng cách tắt kiểm tra hoặc xóa evidence.

## 6. Bằng chứng bắt buộc (evidence)

Tối thiểu cho mọi SEV-2+ (và khuyến nghị SEV-3 nếu Production-adjacent):

| Evidence | Yêu cầu |
|----------|---------|
| Incident ID + severity + type | Bắt buộc |
| Environment + approximate blast radius | Bắt buộc |
| Timeline (detect / ack / contain / recover / close) | Bắt buộc |
| Ownership roles assigned | Bắt buộc cho SEV-1+ |
| Links to logs/alerts/PRs/deploy IDs / ticket IDs | Bắt buộc — **không** dán secret |
| Decision log (rollback vs forward-fix, GO/no-GO) | Bắt buộc trước Production action |
| Communication record (internal / Owner / tenant nếu có) | Theo [07](./07_INCIDENT_COMMUNICATION_AND_POSTMORTEM.md) |

**Cấm trong evidence docs:** secret values, raw service-role keys, bypass recipes, exploit steps.

## 7. Related repository evidence (read-only references)

- Module QA incident template: `docs/v5/qa/team-tournament/templates/TT9_INCIDENT_LOG.md` (P0/P1/P2 — module scope).
- PGO-01 deferred track: Notification Production Phase 2C = `DEFERRED_BY_OWNER` ([PGO-01 §03](../03_ROLLOUT_AND_DEFERRED_TRACK_REGISTER.md)).
- Authority matrix: [PGO-01 §04](../04_ENVIRONMENT_AND_AUTHORITY_MATRIX.md), [§05](../05_CI_CD_AND_RELEASE_AUTHORITY.md).

PGO-02 không thay các template module; chỉ cung cấp **platform severity SSOT**.

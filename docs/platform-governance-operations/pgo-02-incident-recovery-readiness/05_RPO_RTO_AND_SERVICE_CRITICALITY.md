# 05 — RPO, RTO And Service Criticality

**Workstream:** PGO-02
**Fresh `origin/main`:** `12a559c1214e980e2f734ef70f308e87b3a66df7`
**Snapshot timestamp:** `2026-07-25T21:00:26+07:00`
**Rule:** Không tự đặt cam kết Production chính thức nếu chưa có evidence + Owner approval. Mọi target chưa phê duyệt = **`PROVISIONAL_NOT_CERTIFIED`**.

## 1. Definitions

| Term | Meaning |
|------|---------|
| **RPO** (Recovery Point Objective) | Lượng mất dữ liệu tối đa chấp nhận được đo bằng thời gian (ví dụ: dữ liệu mới hơn X phút có thể mất) |
| **RTO** (Recovery Time Objective) | Thời gian tối đa chấp nhận được để khôi phục dịch vụ về mức dùng được sau sự cố |
| **Service criticality** | Mức độ quan trọng của dịch vụ/path đối với vận hành Production |
| **Tiering** | Nhóm dịch vụ theo criticality để gán mục tiêu RPO/RTO khác nhau |
| **Provisional target** | Mục tiêu làm việc nội bộ — **chưa** phải cam kết Production chính thức |

## 2. Service criticality tiers (provisional)

| Tier | Criticality | Ví dụ path (minh họa ownership — không phải inventory đầy đủ) | Default posture |
|------|-------------|---------------------------------------------------------------|-----------------|
| **T0** | Platform-critical | Auth session path, tenant isolation boundary, Production deploy pipeline integrity | Highest scrutiny; SEV-0/1 likely if broken |
| **T1** | Business-critical | Core club/tournament operate paths được Owner chỉ định | High |
| **T2** | Business-important | Secondary modules, reporting, non-blocking channels | Medium |
| **T3** | Best-effort / deferred | Tracks `DEFERRED_BY_OWNER` (ví dụ Notification Production Phase 2C), experimental | No Production RPO/RTO commitment from PGO-02 |

Classification chi tiết từng feature = **Business Module + Owner** — PGO không tự inventory toàn bộ product.

## 3. Provisional targets (NOT certified)

Trạng thái toàn bộ bảng dưới:

```text
PROVISIONAL_NOT_CERTIFIED
```

| Tier | Provisional RPO | Provisional RTO | Conditions / caveats |
|------|-----------------|-----------------|----------------------|
| T0 | ≤ 24h **if** backup evidence exists; else **UNDEFINED until backup exists** | ≤ 8h for availability restore path **if** rollback/vendor path known | Without backup/PITR evidence, RPO cannot be claimed |
| T1 | ≤ 24h provisional | ≤ 24h provisional | Module-owned recovery may tighten with Owner GO |
| T2 | ≤ 72h provisional | ≤ 72h provisional | May accept forward-fix over restore |
| T3 | No commitment | No commitment | Deferred tracks stay deferred |

**Rationale for honesty:** Repository evidence lịch sử cho thấy Production từng không có PITR trên Free/Nano; GA checklist có mục “Backup / PITR đã bật” nhưng đó là **checklist item**, không phải proof hiện hành. Do đó PGO-02 **không** công bố RPO/RTO Production chính thức.

## 4. Evidence requirement

Trước khi nâng target từ provisional → certified:

| Evidence | Required for certification |
|----------|----------------------------|
| Backup mechanism + recent successful backup evidence | Yes for any finite RPO |
| Restore-test or documented restore drill result | Yes for claiming RTO based on restore |
| Rollback path authority + rehearsal note (app/deploy) | Yes if RTO dựa trên rollback thay vì restore |
| External platform dependency acknowledged | Yes (Supabase/Vercel/GitHub) |
| Owner approval record | **Yes — bắt buộc** |
| Monitoring/logging sufficient to detect breach of RTO clock | Recommended; gap recorded if missing |

Thiếu evidence → giữ `PROVISIONAL_NOT_CERTIFIED` hoặc `UNDEFINED`.

## 5. Owner approval

| Action | Authority |
|--------|-----------|
| Propose provisional targets | Platform Governance / Ops (this doc) |
| Change provisional numbers | Platform Ops + module owners consulted |
| Certify Production RPO/RTO | **Owner GO only** |
| Publish external customer SLA from these numbers | **Forbidden** until Owner GO + legal/commercial track (out of PGO-02) |

## 6. External platform dependency

| Dependency | Impact on RPO/RTO |
|------------|-------------------|
| Supabase backup/PITR plan | Bound RPO floor; if unavailable, RPO may be `UNDEFINED` |
| Vercel rollback / redeploy | Bound app RTO for deployment faults |
| GitHub Actions verification | Không thay RTO; là release gate |
| Identity/email/SMS vendors | Module T2/T3 often; outage ≠ always T0 |

External capability **không** được tính là “đã implement trong repo”.

## 7. Review cadence

| Cadence | What |
|---------|------|
| Mỗi PGO readiness review | Re-check backup/PITR evidence honesty; update provisional table if facts change |
| Sau SEV-0/1 | Revisit tier + targets for affected services |
| Trước Production certification ([08](./08_PRODUCTION_OPERATIONAL_READINESS_CERTIFICATION.md)) | Owner GO quyết định certify / conditions / not ready |
| Khi đổi Supabase plan hoặc deploy host | Re-audit external dependency — không copy số cũ |

## 8. Explicit non-claims

- PGO-02 **không** certify RPO/RTO Production.
- PGO-02 **không** mở Notification Phase 2C để “đủ T1 messaging RTO”.
- PGO-02 **không** suy diễn PITR enabled.

# PGO-03 — Platform Observability, Logging & Alerting Governance

**Workstream:** PGO-03 — PLATFORM OBSERVABILITY, LOGGING & ALERTING GOVERNANCE
**Scope:** Documentation only (policy, ownership, taxonomy, evidence, readiness gate)
**Owner GO:** GRANTED (read-only evidence audit → documentation-first → **no runtime integration**)
**Branch:** `feature/pgo-03-observability-logging-alerting-governance`
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\platform-governance-operations-pgo-03-observability`
**Fresh `origin/main` (snapshot):** `0b71e2a7d3a127cc2d6a7520c9a705bed77f2501`
**Local HEAD (snapshot):** `0b71e2a7d3a127cc2d6a7520c9a705bed77f2501`
**`origin/main` subject:** Merge pull request #275 — PGO-02 incident/recovery readiness
**`origin/main` date:** `2026-07-25 21:29:27 +0700`
**Snapshot timestamp:** `2026-07-25T22:35:46+07:00`
**Ahead/behind vs `origin/main`:** ahead **0** / behind **0**

## Mục tiêu

Xây dựng **governance foundation** cho:

1. Technical logging
2. Security audit logging
3. Business audit event boundary
4. Request and correlation identifiers
5. Error reporting
6. Metrics
7. Tracing
8. Health checks
9. Uptime monitoring
10. Alerting
11. Alert severity and routing
12. Observability ownership
13. Data redaction and log privacy
14. Evidence retention
15. Monitoring readiness certification
16. Production observability readiness (model only — **not** self-certified here)

PGO-03 **chỉ** định nghĩa policy, ownership, taxonomy, evidence requirements và readiness gate.

## Phạm vi

| In scope | Out of scope |
|----------|--------------|
| Taxonomy & ownership of log/metric/trace/alert/incident evidence | Sentry / Datadog / New Relic / OpenTelemetry runtime wiring |
| Logging & correlation standards | Configuring Vercel Analytics / Monitoring |
| Security audit logging & privacy rules | Configuring Supabase log drains / Logflare |
| Error classification linked to PGO-02 | Creating new health endpoints or probes |
| Metrics / tracing / health **policy** | Running Production health probes |
| Alert severity, routing, escalation mapping | Enabling alert channels or paging |
| Retention / redaction / access governance | Setting Production SLA or certified retention without Owner/Data Owner |
| Observability readiness certification **model** | Declaring Production observability certified |

## Ownership boundary

| Layer | Owner | PGO-03 role |
|-------|--------|-------------|
| PGO-03 docs (`…/pgo-03-observability-logging-alerting/**`) | Owner GO + PGO workstream | Observability governance SSOT |
| PGO-01 registry (root `docs/platform-governance-operations/*`) | Owner GO + PGO | Governance baseline — **read-only** in PGO-03 |
| PGO-02 incident/recovery (`…/pgo-02-incident-recovery-readiness/**`) | Owner GO + PGO | Incident / escalation baseline — **read-only** in PGO-03 |
| Platform Operations | Platform ops | Execute logging/alerting ops under documented authority |
| Security | Security Owner | Security audit logs, access to security evidence |
| Privacy / Data | Data Owner + Privacy | Retention approval, PII minimization, legal hold |
| Business Module | Module owners | Module metrics/events/audit — not Platform Core by default |
| External Platform | Supabase / Vercel / GitHub (+ env authority) | Vendor capability ≠ repository implementation |
| Notification Production Phase 2C | Notification owner + Owner GO | **`DEFERRED_BY_OWNER`** — không mở lại |

## Quan hệ với PGO-01 và PGO-02

- **PGO-01:** worktree registry, collision map, rollout/deferred register (incl. Notification 2C), environment & CI/CD authority.
- **PGO-02:** incident severity SEV-0…3, ownership/escalation, runbooks, operational readiness model (monitoring/logging marked GAP/PARTIAL).
- **PGO-00 gap:** “No platform IR / observability / RPO-RTO SSOT” — PGO-02 covered IR/RPO-RTO docs; **PGO-03** covers observability / logging / alerting SSOT.
- PGO-03 **không** sửa file PGO-01 hoặc PGO-02; chỉ tạo subtree `pgo-03-observability-logging-alerting/`.

## Không chứa business rules

PGO-03 không định nghĩa luật giải, Elo, subscription SKU, pairing rules, billing logic, notification delivery policy, hay schema nghiệp vụ. Chỉ mô tả **loại evidence quan sát được, ai sở hữu, trường bắt buộc, và gate sẵn sàng**.

## Không tích hợp runtime

Trong PGO-03 **cấm**:

- Kết nối Sentry hoặc vendor APM
- Cấu hình Vercel monitoring / Analytics
- Cấu hình Supabase logging
- Thay environment variable / secret
- Chạy Production health probe
- Deploy / migration / SQL/RLS apply
- Reopen Notification Production Phase 2C
- Tự cấp `OBSERVABILITY_READINESS_CERTIFIED` cho Production

## Mục lục

| File | Nội dung |
|------|----------|
| [01_OBSERVABILITY_TAXONOMY_AND_OWNERSHIP.md](./01_OBSERVABILITY_TAXONOMY_AND_OWNERSHIP.md) | Taxonomy + ownership + anti-duplication |
| [02_LOGGING_AND_CORRELATION_STANDARD.md](./02_LOGGING_AND_CORRELATION_STANDARD.md) | Structured logging + correlation IDs |
| [03_SECURITY_AUDIT_LOGGING_AND_PRIVACY.md](./03_SECURITY_AUDIT_LOGGING_AND_PRIVACY.md) | Security audit + redaction + access |
| [04_ERROR_REPORTING_AND_FAILURE_CLASSIFICATION.md](./04_ERROR_REPORTING_AND_FAILURE_CLASSIFICATION.md) | Error classes + PGO-02 linkage |
| [05_METRICS_TRACING_AND_HEALTH_CHECKS.md](./05_METRICS_TRACING_AND_HEALTH_CHECKS.md) | Metrics, traces, health policy |
| [06_ALERT_SEVERITY_ROUTING_AND_ESCALATION.md](./06_ALERT_SEVERITY_ROUTING_AND_ESCALATION.md) | Alert INFO/WARNING/CRITICAL → SEV map |
| [07_LOG_RETENTION_REDACTION_AND_ACCESS.md](./07_LOG_RETENTION_REDACTION_AND_ACCESS.md) | Retention / redaction / access |
| [08_OBSERVABILITY_READINESS_CERTIFICATION.md](./08_OBSERVABILITY_READINESS_CERTIFICATION.md) | Readiness checklist + verdict vocabulary |
| [09_PGO_03_CERTIFICATION_CHECKLIST.md](./09_PGO_03_CERTIFICATION_CHECKLIST.md) | Path-only / safety certification for this run |

## Hard constraints (PGO-03)

- Chỉ tạo/sửa dưới `docs/platform-governance-operations/pgo-03-observability-logging-alerting/**`.
- Không sửa `.github/**`, `scripts/ci/**`, package/lockfiles, `src/**`, `api/**`, `supabase/**`, migrations, env, deploy config, PGO-01, PGO-02.
- Notification Production Phase 2C = **`DEFERRED_BY_OWNER`**.
- Mọi retention target chưa Owner/Data Owner phê duyệt = **`PROVISIONAL_NOT_CERTIFIED`**.
- Không tuyên bố Sentry / Vercel Analytics / Supabase logs / alerting “đã bật” nếu không có repository hoặc external proof được Owner cung cấp.

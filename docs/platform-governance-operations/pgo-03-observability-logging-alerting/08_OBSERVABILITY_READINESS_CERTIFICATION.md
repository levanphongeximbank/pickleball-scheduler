# 08 — Observability Readiness Certification

**Workstream:** PGO-03
**Fresh `origin/main`:** `0b71e2a7d3a127cc2d6a7520c9a705bed77f2501`
**Snapshot timestamp:** `2026-07-25T22:35:46+07:00`
**Rule:** PGO-03 **không tự cấp** chứng nhận Production observability. Owner GO là authority duy nhất cho verdict cuối.

## Verdict vocabulary

| Verdict | Meaning |
|---------|---------|
| `OBSERVABILITY_READINESS_CERTIFIED` | Owner GO xác nhận đủ evidence theo checklist |
| `CERTIFIED_WITH_CONDITIONS` | Owner GO chấp nhận có điều kiện — điều kiện + owner + review date bắt buộc |
| `NOT_READY` | Thiếu evidence/runtime/authority critical |
| `DEFERRED_BY_OWNER` | Owner chủ động trì hoãn |

## PGO-03 implementation snapshot verdict

```text
VERDICT: NOT_READY
REASON: Documentation model only; no runtime monitoring integration in PGO-03;
        no Owner GO certification issued; retention targets PROVISIONAL_NOT_CERTIFIED;
        platform alerting/dashboards/uptime program not evidenced as PASS on origin/main;
        partial foundations only (API requestId, /health, identity audit_logs, module observability).
```

## Certification checklist

| # | Item | Evidence expectation | PGO-03 snapshot status |
|---|------|----------------------|------------------------|
| 1 | Logging taxonomy | [01](./01_OBSERVABILITY_TAXONOMY_AND_OWNERSHIP.md) adopted | **Model present** |
| 2 | Correlation identifiers | request/correlation/trace standard [02](./02_LOGGING_AND_CORRELATION_STANDARD.md) + runtime coverage | **PARTIAL** — API `requestId` + Platform Core contract fields; not platform-wide structured logging |
| 3 | Security audit logs | Catalog + server SoT [03](./03_SECURITY_AUDIT_LOGGING_AND_PRIVACY.md) | **PARTIAL** — Identity/module audit features exist; not full platform IR logging SSOT ops |
| 4 | Redaction | Secret/PII rules enforced in emitters | **Model present** — runtime enforcement **NOT ASSUMED** |
| 5 | Error reporting | Classification [04](./04_ERROR_REPORTING_AND_FAILURE_CLASSIFICATION.md) + reporting sink | **PARTIAL model** — no centralized error SaaS evidenced in package.json |
| 6 | Metrics | Golden signals owned & emitted | **GAP / module-partial** (e.g. TT realtime injectable) |
| 7 | Tracing | Propagation + store | **GAP** — OTel transitive ≠ enabled tracing |
| 8 | Health checks | Liveness/readiness/dependency program | **PARTIAL** — `GET /api/v1/health` exists; full program **GAP** |
| 9 | Dashboards | Owned panels with last-verified evidence | **GAP / NOT ASSUMED** |
| 10 | Alert rules | Documented CRITICAL/WARNING rules | **GAP / NOT ASSUMED** |
| 11 | Routing | On-call / role routes | **Model present** — live roster not stored here |
| 12 | Escalation | Maps to PGO-02 | **Model present** ([06](./06_ALERT_SEVERITY_ROUTING_AND_ESCALATION.md)) |
| 13 | External platform verification | Vercel/Supabase monitoring/logs verified | **External — not inferred** |
| 14 | Retention | Owner/Data Owner approved targets | **`PROVISIONAL_NOT_CERTIFIED`** |
| 15 | Access control | Who can read/export logs | **Model present** — Production access evidence pending |
| 16 | Unresolved gaps | Listed below | See § Unresolved gaps |
| 17 | Owner GO | Explicit approval for verdict | **Pending Owner** |
| 18 | Certification verdict | One of four values | **`NOT_READY`** (this run) |

## Unresolved gaps (snapshot)

1. No platform-wide structured logging standard enforced in runtime (console-heavy legacy).
2. No evidenced Sentry/APM/Vercel Analytics enablement from `package.json` at snapshot.
3. No platform alert-rule / paging SSOT in repo.
4. No certified uptime/synthetic monitoring evidence attached to PGO-03.
5. Retention targets remain **`PROVISIONAL_NOT_CERTIFIED`**.
6. Distributed tracing not evidenced as enabled (despite transitive OTel API in lockfile).
7. PGO-02 already recorded monitoring GAP / logging PARTIAL — still accurate.
8. Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`** — not a reopen candidate for messaging observability.

## Conditions template (if Owner later chooses `CERTIFIED_WITH_CONDITIONS`)

| Field | Required |
|-------|----------|
| Condition ID | Yes |
| Description | Yes |
| Owner | Yes |
| Due / review date | Yes |
| Risk if unmet | Yes |
| Related evidence path | Yes |

## Explicit non-actions

- PGO-03 không đánh dấu `OBSERVABILITY_READINESS_CERTIFIED`.
- PGO-03 không tích hợp runtime monitoring để “tạo PASS”.
- PGO-03 không mở Notification Phase 2C.
- PGO-03 không chạy Production health probe.

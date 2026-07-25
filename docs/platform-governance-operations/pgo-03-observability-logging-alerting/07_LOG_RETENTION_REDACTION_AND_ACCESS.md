# 07 — Log Retention, Redaction And Access

**Workstream:** PGO-03
**Fresh `origin/main`:** `0b71e2a7d3a127cc2d6a7520c9a705bed77f2501`
**Snapshot timestamp:** `2026-07-25T22:35:46+07:00`
**Rule:** Mọi retention target chưa được Owner/Data Owner phê duyệt phải ghi **`PROVISIONAL_NOT_CERTIFIED`**.

## 1. Retention classification

| Class | Nội dung điển hình | Retention authority |
|-------|--------------------|---------------------|
| **Operational logs** | Technical application logs, request diagnostics | Platform Ops + Data Owner |
| **Security logs** | Auth/authz/privileged/tenant-boundary audit | Security Owner + Data Owner |
| **Audit evidence** | Business + security audit records needed for compliance/IR | Domain owner + Data Owner + Owner GO (Production policy) |
| **Metrics / traces** | Time-series and span stores | Platform Ops + Data Owner |
| **Alert history** | Firings, acks, suppressions | Platform Ops |
| **Incident evidence** | PGO-02 timelines, decision logs | IC + Owner GO |

## 2. Provisional retention targets (NOT CERTIFIED)

Các số dưới đây chỉ là **placeholder governance** để Owner/Data Owner phê duyệt sau — **không** phải Production commitment:

| Class | Provisional target | Status |
|-------|--------------------|--------|
| Operational logs | 30 days hot / review for warm archive | **`PROVISIONAL_NOT_CERTIFIED`** |
| Security logs | 180 days (or longer if legal requires) | **`PROVISIONAL_NOT_CERTIFIED`** |
| Business audit evidence | 365 days (module may set stricter) | **`PROVISIONAL_NOT_CERTIFIED`** |
| Metrics | 90 days high-res / rollups TBD | **`PROVISIONAL_NOT_CERTIFIED`** |
| Traces | 14–30 days | **`PROVISIONAL_NOT_CERTIFIED`** |
| Alert history | 90 days | **`PROVISIONAL_NOT_CERTIFIED`** |
| Incident evidence | Align Owner legal/compliance hold | **`PROVISIONAL_NOT_CERTIFIED`** until Owner sets |

**Không** công bố đây là SLA/retention chính thức.

## 3. Personal-data minimization & tenant data

1. Prefer opaque ids over names/emails/phones in logs.
2. Tenant data in logs must be **tenant-scoped** in access control when stored in shared systems.
3. Do not copy Production log exports into git.
4. Module analytics events (IA contracts, etc.) remain module/privacy-governed — not automatically “security audit”.

## 4. Redaction

| Stage | Requirement |
|-------|-------------|
| Emit | Deny-list secrets; minimize PII ([03](./03_SECURITY_AUDIT_LOGGING_AND_PRIVACY.md)) |
| Store | Field-level redaction where vendors support; document gaps |
| Export | Redact before share outside authorized roles |
| Display (UI) | Mask tokens; show codes not secrets |

## 5. Deletion & legal/compliance hold

| Action | Authority |
|--------|-----------|
| Routine expiry per approved policy | Platform Ops / Data Owner under policy |
| Early deletion of security evidence | **Forbidden** without Security + Owner GO |
| Legal / compliance hold | Data Owner + Owner GO — suspend deletion |
| Tenant offboarding data deletion | Data Owner + module owner — must not silently destroy required security holds |

## 6. Access & export

| Need | Authority |
|------|-----------|
| Ops debug (Staging) | Platform Ops / module owner |
| Ops debug (Production) | Platform Ops + **Owner GO** when policy requires |
| Security investigation | Security Owner |
| External auditor export | Owner GO + Data Owner + Security as applicable |
| Vendor support share | Redacted; Owner GO for Production |

## 7. External platform retention

| Platform | Rule |
|----------|------|
| Vercel logs / Analytics | **External Platform ownership** — verify in vendor console; not inferred |
| Supabase logs / Auth logs / Dashboard | **External Platform ownership** — verify; Free/plan limits may apply |
| GitHub Actions logs | CI ownership + GitHub retention |
| Browser localStorage debug | Not durable IR evidence |

Document vendor plan limits as **external evidence** when certifying readiness — PGO-03 does not assume them.

## 8. Evidence required for any certified retention claim

1. Written approval (Owner + Data Owner; Security for security class).
2. System where data lives (repo feature vs vendor).
3. Retention length + disposal method.
4. Access control summary.
5. Last review date.

Absent → remain **`PROVISIONAL_NOT_CERTIFIED`** / readiness **NOT_READY** for retention item.

## 9. Explicit non-actions

- PGO-03 không set vendor retention.
- PGO-03 không xóa/giữ log Production.
- PGO-03 không commit dữ liệu log thật.

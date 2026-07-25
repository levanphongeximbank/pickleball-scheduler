# 04 — Error Reporting And Failure Classification

**Workstream:** PGO-03
**Fresh `origin/main`:** `0b71e2a7d3a127cc2d6a7520c9a705bed77f2501`
**Snapshot timestamp:** `2026-07-25T22:35:46+07:00`
**Rule:** Phân loại để ownership và evidence — không mô tả exploit. Link sang PGO-02 khi đủ điều kiện incident.

## 1. Failure classes

| Class | Định nghĩa | Default owner |
|-------|------------|---------------|
| **Handled error** | Caught; mapped to stable code; user path controlled | Module / API owner |
| **Unhandled error** | Not caught at boundary; unexpected throw/crash | Module owner + Platform Ops if platform surface |
| **Expected domain rejection** | Business rule deny (validation, state machine) — not a platform outage | Business Module Owner |
| **Dependency failure** | Downstream library/service/DB/API fail | Module + External Platform Owner if vendor |
| **Timeout** | Deadline exceeded | Module + Platform Ops / External as applicable |
| **Degraded operation** | Partial function; workaround may exist | Module / Platform Ops |
| **Security failure** | Authn/authz failure, suspected compromise signal | Security Owner |
| **Tenant-isolation failure** | Cross-tenant read/write beyond boundary | Security + Data Owner (**SEV escalate**) |
| **User-visible error** | Error surfaced to end user UI/API envelope | Module owner (UX + code) |

## 2. Retryability

| Label | Meaning | Guidance |
|-------|---------|----------|
| **Retryable** | Safe to retry with backoff (idempotent or explicitly safe) | Limit attempts; log attempt count + correlation_id |
| **Non-retryable** | Retry will not help or may duplicate side effects | Fail closed; surface stable code |
| **Unknown** | Not classified yet | Treat cautiously; prefer non-retry until proven |

Expected domain rejections thường **non-retryable**. Timeouts/dependency blips có thể **retryable** nếu idempotent.

## 3. Error ownership matrix

| Observation | Ownership |
|-------------|-----------|
| Competition / Club / Finance / Notification domain code | Business Module — **not** automatic Platform Core |
| Shared API edge envelope / requestId plumbing | Platform / API surface owner |
| Supabase outage / PostgREST 5xx | External Platform (+ module impact note) |
| Vercel function crash / deploy region issue | External Platform + deployment authority |
| RLS/policy defect causing isolation break | Security + tenant-isolation incident path (PGO-02) |
| Missing module metric / module logger | Module gap — not Platform Core failure |

## 4. Evidence requirements

For Production-impacting errors (and recommended for Staging blockers):

| Evidence | Required |
|----------|----------|
| `timestamp`, `environment`, `service/module` | Yes |
| `request_id` / `correlation_id` when available | Yes |
| `error_class`, `error_code`, `retryable` | Yes |
| User-visible message vs internal detail separation | Yes |
| Link to deploy/release id if known | Recommended |
| Security/tenant flags if suspected | Yes → Security Owner |

**Cấm:** secret values, full auth headers, raw tokens in error reports or screenshots committed to git.

## 5. Linkage sang PGO-02 incident

```text
Error / alert signal
  → Classify failure (this doc)
  → If attention rule fires → Alert ([06](./06_ALERT_SEVERITY_ROUTING_AND_ESCALATION.md))
  → If impact confirmed per PGO-02 → Incident record (SEV-0…3)
  → Else: ticket / backlog / module fix — no incident inflation
```

| Trigger | Action |
|---------|--------|
| Isolated handled domain rejection | No incident by default |
| Elevated error rate / outage symptom | Alert → investigate → possible SEV-1/2 |
| Confirmed tenant-isolation or data-loss | Immediate PGO-02 **SEV-0/1** path |
| External vendor outage | External-platform incident type (PGO-02) |

PGO-03 **không** tự tạo incident records.

## 6. Repository evidence notes

- Module error code catalogs exist (e.g. Finance readiness codes) — **module-owned**.
- API health returns feature-disabled / ok envelopes in historical QA docs — operational signal, not full error-reporting program.
- No repository evidence of centralized Sentry (or equivalent) project binding in `package.json` at snapshot → error reporting vendor = **NOT ASSUMED ENABLED**.

## 7. Explicit non-actions

- Không cấu hình error-tracking SaaS trong PGO-03.
- Không chạy Production probes để “tạo” error evidence.
- Không mở Notification Phase 2C để “đủ” messaging error path.

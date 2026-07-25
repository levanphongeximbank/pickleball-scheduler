# 05 — Metrics, Tracing And Health Checks

**Workstream:** PGO-03
**Fresh `origin/main`:** `0b71e2a7d3a127cc2d6a7520c9a705bed77f2501`
**Snapshot timestamp:** `2026-07-25T22:35:46+07:00`
**Rule:** Đây là **policy**. PGO-03 không tạo endpoint hoặc probe thật, không cấu hình dashboard vendor.

## 1. Golden signals & related metrics (policy)

| Signal | Metric examples | Owner |
|--------|-----------------|-------|
| **Availability** | Success ratio of critical paths; uptime of health surface | Platform Ops / External Platform as applicable |
| **Latency** | p50/p95/p99 request or job duration (histogram) | Module + Platform Ops |
| **Throughput** | Requests/jobs per time (counter/rate) | Module + Platform Ops |
| **Error rate** | 5xx / failed job ratio | Module + Platform Ops |
| **Saturation** | Queue depth, concurrency, connection pool usage | Module / Platform Ops / External |
| **Queue / job status** | Pending / running / failed / DLQ counts **if** jobs exist | Module owner of job system |
| **Database dependency status** | Reachability / error class of DB calls (not raw credentials) | Data Owner + External (Supabase) + module |
| **External dependency status** | Payment, email, identity provider, storage | Module + External Platform Owner |

Missing **module-specific** metric ≠ Platform Core defect.

## 2. Health check types (definitions)

| Type | Meaning | PGO-03 expectation |
|------|---------|--------------------|
| **Liveness** | Process/service is running | Define ownership; implement outside PGO-03 |
| **Readiness** | Safe to receive traffic / critical deps OK | Define ownership; implement outside PGO-03 |
| **Dependency health** | Named dependency probe result | Module/External; record in evidence when claimed |
| **Synthetic monitoring** | External periodic check of critical user path | External/Platform Ops; **not** assumed from repo alone |

### Repository evidence (partial — do not over-claim)

| Evidence | Status |
|----------|--------|
| `GET /api/v1/health` routed (`apiRouter` / `edgeApiRouter`); OpenAPI `/health`; Phase 11/12 QA docs | **Exists** as API health surface |
| Historical Preview/Staging QA of health 200/`ok` | Historical evidence — **not** continuous Production uptime certification |
| Finance `readiness.js` probes | **Module-owned** readiness helpers |
| Ecosystem `healthReadinessProjection.js` | **Module-owned** projection |
| Competition Engine observability docs (e2e/phase) | **Module-owned** documentation |
| Platform-wide liveness/readiness/uptime program + dashboards | **GAP / NOT ASSUMED** as certified |

PGO-03 **không** chạy Production health probe trong workstream này.

## 3. Tracing policy

| Topic | Rule |
|-------|------|
| Purpose | Correlate request/workflow across modules/services |
| Propagation | Prefer `trace_id` + `correlation_id` ([02](./02_LOGGING_AND_CORRELATION_STANDARD.md)) |
| Attributes | No secrets; tenant-safe ids only |
| Vendor OTel/APM | Optional future runtime — **out of scope** for PGO-03 |
| Lockfile `@opentelemetry/api` transitive | **Not** evidence of enabled tracing |

Platform Core event/trace context adapters provide **contract-level** correlation fields — classify as **partial foundation**, not Production distributed tracing.

## 4. Uptime monitoring

| Claim | Allowed only if |
|-------|-----------------|
| “Uptime monitored” | Named tool/owner + check URL/path + evidence of recent checks (Owner/ops provided) |
| “Vercel/Supabase monitors Production” | External proof — not inferred from repo |
| “Health endpoint exists” | Source/OpenAPI/QA evidence (present for `/api/v1/health`) |
| “Production observability ready” | Owner GO verdict via [08](./08_OBSERVABILITY_READINESS_CERTIFICATION.md) — **not** this doc alone |

## 5. Dashboard evidence

Dashboards (ops or vendor) phải ghi:

1. Owner
2. Environment scope
3. Metrics/panels covered
4. Link or export evidence (no secrets)
5. Last verified timestamp

Absent dashboard evidence → readiness item remains **GAP**.

## 6. Explicit non-actions

- Không tạo `/healthz` mới trong PGO-03.
- Không bật synthetic monitors.
- Không cấu hình Vercel Analytics / Speed Insights / Monitoring.
- Không tuyên bố Production SLA.

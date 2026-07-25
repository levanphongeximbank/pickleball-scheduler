# 02 — Logging And Correlation Standard

**Workstream:** PGO-03
**Fresh `origin/main`:** `0b71e2a7d3a127cc2d6a7520c9a705bed77f2501`
**Snapshot timestamp:** `2026-07-25T22:35:46+07:00`
**Rule:** Chuẩn này áp dụng cho **technical application logs** và các field correlation dùng chung. Không bắt buộc đưa personal data hoặc tenant secret vào log.

## 1. Structured logging expectation

Technical logs nên là **structured** (JSON hoặc equivalent key/value), không chỉ free-text `console.log`, khi phục vụ Production investigation.

| Field | Required? | Mô tả |
|-------|-----------|--------|
| `timestamp` | Yes | ISO-8601 UTC hoặc timezone rõ ràng |
| `environment` | Yes | `local` / `dev` / `test` / `staging` / `preview` / `production` (đúng authority PGO-01 §04) |
| `service` / `module` | Yes | Tên service hoặc module owner (ví dụ `api-v1`, `identity`, `team-tournament`) |
| `severity` | Yes | Align §3 |
| `event_name` | Yes | Stable machine-readable name |
| `message` | Recommended | Human-readable summary — no secrets |
| `request_id` | Yes when request-scoped | ID cho một HTTP/API request |
| `correlation_id` | Yes when workflow spans components | ID nối nhiều request/job/events |
| `trace_id` | Recommended when tracing exists | Distributed trace identifier |
| `tenant_safe_id` | Optional | Tenant/club reference **safe** for logs (opaque ID) — never secret |
| `error_class` | When error | See [04](./04_ERROR_REPORTING_AND_FAILURE_CLASSIFICATION.md) |
| `source` | Recommended | `app` / `api` / `worker` / `edge` / `db-trigger` / `external` |
| `schema_version` | Recommended | Version of this log schema (e.g. `pgo03-log/1`) |

**Không bắt buộc:** email, phone, full name, address, payment PAN, raw JWT, service-role key, password, session token.

## 2. Identifier definitions

| ID | Scope | Propagation |
|----|-------|-------------|
| **request_id** | Một inbound request (HTTP/API) | Generate at edge/handler; return in response header/body envelope when applicable; include in all logs for that request |
| **correlation_id** | Một business/workflow chain (có thể nhiều request_id) | Accept from trusted caller **or** mint new; propagate to downstream calls and async jobs |
| **trace_id** | Distributed tracing span tree | Propagate per chosen tracing standard **when** tracing is implemented (future runtime work — **out of PGO-03**) |
| **causation_id** (optional) | Event that caused this event | Platform Core adapters already model optional causation in event audit contracts — keep aligned when used |

### Repository evidence (partial)

- `src/features/api/utils/requestId.js` — `createRequestId()`
- `api/v1/[...path].js` — assigns `requestId` per request
- Platform Core adapters: `correlationId` / `requestId` on security & event trace context — **contracts**, not full ops logging pipeline

## 3. Severity (technical logs)

| Severity | Dùng khi |
|----------|----------|
| `DEBUG` | Dev/staging diagnostics; avoid Production volume unless temporarily authorized |
| `INFO` | Normal significant lifecycle |
| `WARN` | Degraded / unexpected but handled |
| `ERROR` | Failure impacting request/job success |
| `FATAL` / `CRITICAL` | Process/service cannot continue safely |

Alert severity (INFO/WARNING/CRITICAL) được định nghĩa riêng ở [06](./06_ALERT_SEVERITY_ROUTING_AND_ESCALATION.md) — **không** đồng nhất 1:1 với log severity.

## 4. Error classification fields

Khi log lỗi, ghi tối thiểu:

- `error_class` (handled / unhandled / dependency / timeout / security / tenant-isolation / … — xem [04](./04_ERROR_REPORTING_AND_FAILURE_CLASSIFICATION.md))
- `retryable` (`true` / `false` / `unknown`)
- `user_visible` (`true` / `false`)
- stable `error_code` nếu module đã có mã lỗi

Không dump stack kèm secret/env values.

## 5. Propagation rules

1. Edge/API tạo `request_id` nếu thiếu.
2. Nếu caller gửi `correlation_id` hợp lệ → giữ; nếu thiếu → mint và ghi `correlation_id_source=generated`.
3. Downstream HTTP/RPC/job payload nên mang `correlation_id` (+ `request_id` của hop hiện tại).
4. Async jobs: correlation_id từ enqueue message là bắt buộc khi job phục vụ user/tenant workflow.
5. Browser UI: không bắt buộc full distributed tracing trong PGO-03; nếu log client-side, redaction rules vẫn áp dụng.

## 6. Missing-correlation handling

| Situation | Required behavior |
|-----------|-------------------|
| Missing `request_id` at edge | Generate; log `request_id_source=generated` |
| Missing `correlation_id` | Generate; log `correlation_id_source=generated` |
| Invalid / oversized ID | Reject or replace with generated; do not trust raw unbounded strings |
| Cross-tenant ID reuse suspected | Security Owner review; do not silently merge tenants |
| Module logger without IDs (legacy `console`) | Treat as **gap** vs this standard — module remediation, not silent PASS |

## 7. Source & schema versioning

- `source` giúp phân tách app vs edge vs worker.
- `schema_version` cho phép evolutions không phá parser.
- Thay đổi breaking field names cần Owner/Platform Ops note trong changelog evidence (future) — PGO-03 chỉ định nghĩa expectation.

## 8. Explicit non-actions

- PGO-03 không thay `src/**` / `api/**` để enforce schema.
- PGO-03 không bắt buộc mọi module migrate trong workstream này.
- PGO-03 không cấu hình log drain vendor.

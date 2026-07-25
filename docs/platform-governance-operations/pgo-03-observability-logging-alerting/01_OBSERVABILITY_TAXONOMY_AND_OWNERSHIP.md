# 01 — Observability Taxonomy And Ownership

**Workstream:** PGO-03
**Fresh `origin/main`:** `0b71e2a7d3a127cc2d6a7520c9a705bed77f2501`
**Snapshot timestamp:** `2026-07-25T22:35:46+07:00`
**Rule:** Không trộn các loại evidence. Module-owned gap ≠ Platform Core defect. External platform capability ≠ repository implementation.

## 1. Taxonomy (bắt buộc phân biệt)

| Type | Định nghĩa | Không phải |
|------|------------|------------|
| **Business audit event** | Sự kiện nghiệp vụ có ý nghĩa domain (ví dụ thay đổi trạng thái giải, billing state transition, club governance write) | Không mặc định là technical application log |
| **Security audit log** | Authentication, authorization denial, privileged action, tenant-boundary event, security configuration change | Không thay business domain event; không chứa secret |
| **Technical application log** | Runtime behavior, errors, dependency calls, request processing diagnostics | Không thay security immutable evidence; không chứa PII thừa |
| **Metric** | Số đo định lượng: counter / gauge / histogram; latency, throughput, error rate, saturation | Không thay log chi tiết; không tự thành incident |
| **Trace** | Request hoặc workflow path; correlation giữa service/module | Không thay business audit event |
| **Alert** | Điều kiện cần attention theo rule/threshold | **Không** đồng nghĩa incident cho đến khi được xác nhận (PGO-02) |
| **Incident record** | Bản ghi sự cố theo PGO-02: severity SEV-0…3, ownership, timeline, closure evidence | Không tạo tự động chỉ vì alert fire |

## 2. Owner từng loại

| Type | Owner mặc định | Co-owners khi cần |
|------|----------------|-------------------|
| Business audit event | **Business Module Owner** (domain) | Data Owner nếu event chứa dữ liệu nhạy cảm |
| Security audit log | **Security Owner** | Identity/Platform ops cho pipeline; Owner GO cho Production access export |
| Technical application log | **Platform Operations** (platform paths) hoặc **Module Owner** (module paths) | Platform Governance cho schema chuẩn |
| Metric | Module Owner (module metrics) / Platform Operations (platform SLIs) | External Platform Owner nếu metric chỉ có ở vendor |
| Trace | Platform Operations + module owners theo span ownership | External Platform Owner nếu vendor-distributed tracing |
| Alert | Platform Operations (platform rules) / Module Owner (module rules) | Security Owner cho security alerts; Owner GO cho Production paging authority |
| Incident record | **Incident Commander** + roles PGO-02 | Owner GO cho Production actions & closure SEV-0/1 |

## 3. Ownership classification (PGO-03)

| Class | Phạm vi quan sát | Quyết định mặc định |
|-------|------------------|---------------------|
| **Platform Governance ownership** | Taxonomy, standards, readiness vocabulary, anti-duplication | PGO-03 docs + Owner GO |
| **Platform Operations ownership** | Technical logs, platform metrics/traces, health aggregation, alert ops | Platform ops under authority matrix |
| **Security ownership** | Security audit logs, authz denial evidence, privileged actions | Security Owner |
| **Privacy / Data ownership** | Retention approval, PII minimization, legal hold, export restrictions | Data Owner + Privacy |
| **Business Module ownership** | Module events, module metrics, module dashboards, module readiness probes | Module owner — **không** mặc định = Platform Core |
| **External Platform ownership** | Vercel runtime logs/analytics, Supabase logs/metrics, GitHub Actions logs | Vendor + environment authority; **không** suy diễn console nếu thiếu evidence |
| **Owner GO** | Production observability certification verdict; reopen deferred tracks; Production alert routing GO | Authority cuối |
| **Deferred tracks** | Notification Production Phase 2C | **`DEFERRED_BY_OWNER`** |

## 4. Evidence boundary

| Evidence class | Allowed content | Forbidden content |
|----------------|-----------------|-------------------|
| Business audit | Domain action, actor reference (tenant-safe), object IDs, outcome | Passwords, tokens, full card data, unrestricted PII dumps |
| Security audit | Auth outcome, role/permission check result codes, privileged action name, tenant rejection reason codes | Session tokens, service-role keys, raw secrets |
| Technical log | Severity, event name, request/correlation IDs, error class, dependency name | Secrets, unrestricted personal data |
| Metric / trace | Numeric series, span metadata, resource names | Secret values in span attributes |
| Alert | Rule ID, severity, firing window, links to dashboards | Secrets in notification payloads |
| Incident (PGO-02) | SEV, timeline, decisions, evidence links | Exploit recipes, secret paste |

## 5. Anti-duplication rule

1. **Một sự kiện nghiệp vụ** → ghi **business audit event** ở module/domain store; chỉ mirror sang security audit khi hành động đồng thời là privileged/security-relevant (ghi rõ dual-write rationale).
2. **Một lỗi runtime** → technical log (+ metric error counter nếu có); chỉ escalate thành **alert** khi rule cho phép; chỉ mở **incident** khi confirm theo PGO-02.
3. **Không** yêu cầu mọi business event phải xuất hiện trong technical log stream.
4. **Không** dùng `console.log` ad-hoc làm substitute cho security audit evidence.
5. **Không** đếm thiếu metric module-specific là lỗi Platform Core.
6. **Không** coi vendor “có thể xem logs trên console” là đã có platform observability governance SSOT.

## 6. Repository evidence notes (read-only snapshot)

| Observation on `origin/main` | Classification |
|------------------------------|----------------|
| Identity `audit_logs` + RPCs (`identity_list_audit_logs`, …) | Security / identity **product** audit — module/platform feature, **not** full PGO observability SSOT |
| `billing_audit_logs` / club `writeAuditLog` / player-management audit paths | **Business Module** audit events |
| Platform Core `correlationId` / `requestId` on event & security context adapters | Contract/adapters — **partial** correlation foundation; not end-to-end ops tracing |
| `createRequestId()` + API `requestId` in `api/v1/[...path].js` | Technical request ID on API edge — **partial** |
| Team Tournament `realtimeObservability.js` | **Module-owned** injectable metrics/logger — no external vendor |
| Finance readiness probes / CE observability docs | **Module-owned** |
| Widespread `console.*` usage | Technical diagnostics — **not** structured platform logging standard |
| No direct Sentry / Datadog / Vercel Analytics dependency evidenced in `package.json` at snapshot | **Do not claim** vendor APM enabled |
| `@opentelemetry/api` appears transitively in lockfile | **Not** evidence of app tracing instrumentation |
| `GET /api/v1/health` documented & routed | Health endpoint **exists** as API feature — not full liveness/readiness/uptime program |
| PGO-02 item “Monitoring evidence” = GAP; “Logging evidence” = PARTIAL | Consistent with this audit |

## 7. Explicit non-claims

- PGO-03 không tuyên bố Production observability đã sẵn sàng.
- PGO-03 không mở Notification Production Phase 2C.
- PGO-03 không tích hợp monitoring runtime.

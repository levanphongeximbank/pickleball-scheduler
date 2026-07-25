# 03 — Security Audit Logging And Privacy

**Workstream:** PGO-03
**Fresh `origin/main`:** `0b71e2a7d3a127cc2d6a7520c9a705bed77f2501`
**Snapshot timestamp:** `2026-07-25T22:35:46+07:00`
**Rule:** Không ghi secret value hoặc session token. Security audit ≠ business audit event (xem [01](./01_OBSERVABILITY_TAXONOMY_AND_OWNERSHIP.md)).

## 1. Security audit event catalog (minimum)

| Event class | Ví dụ vận hành | Owner |
|-------------|----------------|--------|
| **Auth event** | Login success/failure, logout, password reset request/complete, session invalidate | Security + Identity |
| **Authorization denial** | Missing permission, role gate deny, RPC reject | Security + module owning the gate |
| **Privileged action** | User admin update, role/permission change, break-glass, service-role use in ops | Security + Owner GO when Production |
| **Cross-tenant rejection** | Attempted access outside tenant boundary | Security + Data Owner |
| **Security configuration change** | Auth provider settings change, RLS policy apply (ops evidence), API key rotation **record** (metadata only) | Security + environment authority |
| **Access certification evidence** | Periodic access review completion record | Security + Owner GO |

## 2. Immutable evidence expectation

Security audit records phục vụ điều tra phải:

1. Có timestamp + actor reference (user id / system actor) + action + outcome.
2. Không bị chỉnh sửa ad-hoc bởi end-user UI mà không có server authority.
3. Prefer **server-side** write path (RPC/service) làm source of truth khi dual client/server writers tồn tại.
4. Retention & access theo [07](./07_LOG_RETENTION_REDACTION_AND_ACCESS.md).

### Repository evidence (product features — not full platform SSOT)

- Identity: `public.audit_logs`, phase A/B/C SQL docs, UI `/audit`, RPC `identity_list_audit_logs`.
- Docs warn against password/token in `audit_logs.metadata` (staging QA).
- Club Phase 2D: server `phase42_write_audit` SoT; client `writeAuditLog` may be duplicate UX writer.
- Billing: `billing_audit_logs` (module financial audit — classify as business/security-adjacent per event, not generic technical log).

## 3. Redaction & personal-data minimization

| Allowed | Prohibited |
|---------|------------|
| User UUID / opaque actor id | Password, password hash dump |
| Role / permission ids | Raw session access token / refresh token |
| Action name + result code | `SUPABASE_SERVICE_ROLE_KEY` or any secret value |
| Tenant/club opaque id | Full unrestricted PII profiles “just in case” |
| Request/correlation ids | Payment PAN / CVV / bank secrets |
| Error codes | Private keys, webhook signing secrets |

**Minimization:** chỉ log field cần cho security investigation. Prefer codes over free-text user content.

## 4. Secret prohibition (absolute)

Không bao giờ đưa vào security audit payload, technical logs, alerts, hoặc PGO docs:

- Service-role keys, API keys, OAuth client secrets
- JWT / session tokens
- Password / OTP / magic-link tokens
- Encryption keys
- Connection strings with embedded credentials

Chỉ được ghi **tên biến** hoặc “secret rotated” metadata — không giá trị.

## 5. Retention authority

- Security log retention targets require **Security Owner + Data Owner** (+ Owner GO for Production policy).
- Until approved: mark **`PROVISIONAL_NOT_CERTIFIED`** (see [07](./07_LOG_RETENTION_REDACTION_AND_ACCESS.md)).
- External platforms (Supabase Auth logs, Vercel logs) follow vendor retention — **External Platform ownership**; do not invent numbers.

## 6. Access control

| Access need | Authority |
|-------------|-----------|
| Routine security review | Security Owner |
| Identity admin UI `/audit` | Roles/permissions as product-configured — verify RLS/RPC evidence |
| Export security logs | Security Owner + Data Owner + **Owner GO** for Production export |
| Break-glass read | Owner GO + Security Owner; time-boxed; logged |

## 7. Export restrictions

1. Export phải có purpose, requester, time range, approval.
2. Không commit export dumps chứa PII/secrets vào git.
3. Redact trước khi share ngoài Security/Data circle.
4. Module QA screenshots: scrub tokens/PII.

## 8. Explicit non-actions

- PGO-03 không apply SQL/RLS.
- PGO-03 không mở rộng `audit_logs` schema.
- PGO-03 không đọc hoặc in secret values.

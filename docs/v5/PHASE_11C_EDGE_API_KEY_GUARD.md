# Phase 11C — Edge API Router + API Key Guard

**Trạng thái:** Foundation staging/internal — chưa mở public API production.

## 1. Mục tiêu Phase 11C

- Edge API router foundation với prefix `/api/v1`
- API Key Guard an toàn theo tenant (hash-only, scope, revoke/expiry)
- Rate limit guard foundation (in-memory, testable)
- Audit events cho lifecycle API key
- Không gọi provider thật, không mở public API production

## 2. API routes đã tạo

| Method | Path | Scope | Public |
|--------|------|-------|--------|
| GET | `/api/v1/health` | — | ✅ |
| GET | `/api/v1/tenant` | `tenant:read` | ❌ |
| GET | `/api/v1/integrations` | `integrations:read` | ❌ |
| GET | `/api/v1/webhooks/test` | `webhooks:read` | ❌ |
| POST | `/api/v1/webhooks/test` | `webhooks:write` | ❌ |

**Entry points:**
- In-app/test: `invokeEdgeApi()` — `src/features/api/router/edgeApiRouter.js`
- Vercel serverless: `api/v1/[...path].js`

Legacy Sprint 10 routes vẫn qua `invokeApi()` — không đổi behavior.

## 3. API key format

```
pk_<8-char-prefix>.<secret>
```

Ví dụ cấu trúc: `pk_a1b2c3d4.<64-char-secret>`

- **Prefix** (`key_prefix`): lookup nhanh, lưu DB
- **Secret**: chỉ hiển thị một lần khi tạo key
- **Raw key**: không persist, không log

## 4. Hashing design

- Algorithm: **SHA-256** (Web Crypto / `crypto.subtle.digest`)
- Helper: `hashApiKey(plainKey)`, `verifyApiKey(plainKey, storedHash)`
- DB column: `api_keys.hashed_key` (hex digest)
- Không lưu raw secret trong DB, localStorage, audit logs

## 5. Scope matrix

| Scope | Mô tả | Routes |
|-------|-------|--------|
| `tenant:read` | Đọc tenant context | GET `/tenant` |
| `integrations:read` | Đọc integration overview | GET `/integrations` |
| `integrations:write` | *(reserved Phase 11D)* | — |
| `webhooks:read` | Đọc webhook test placeholder | GET `/webhooks/test` |
| `webhooks:write` | Ghi webhook test placeholder | POST `/webhooks/test` |

Sprint 10 scopes (`players:read`, `marketplace:*`, …) vẫn dùng cho `invokeApi()` legacy.

## 6. Rate limit design / enforcement

**Design:** `src/features/api/constants/rateLimitDesign.js`

| Window | Default limit |
|--------|---------------|
| Minute | 120 req |
| Hour | 3,000 req |
| Day | 30,000 req |

**Phase 11C enforcement:** in-memory counter qua `checkRateLimit()` — `src/features/api/guards/rateLimitGuard.js`

- Key pattern: `ratelimit:{tenantId}:{clientId}:{window}:{bucket}`
- Response **429** + headers `X-RateLimit-*`, `Retry-After`
- Production-scale (Redis/Supabase counter) → Phase 11D+

## 7. Error response format

```json
{
  "ok": false,
  "code": "scope_denied",
  "message": "Thiếu scope: integrations:read",
  "data": null,
  "requestId": "uuid"
}
```

**Codes:**

| Code | HTTP | Ý nghĩa |
|------|------|---------|
| `unauthorized` | 401 | Thiếu API key |
| `invalid_api_key` | 401 | Key sai / revoked / expired |
| `forbidden` | 403 | Cross-tenant access |
| `tenant_not_found` | 403 | Key không thuộc tenant yêu cầu |
| `scope_denied` | 403 | Thiếu scope |
| `rate_limited` | 429 | Vượt quota |
| `not_found` | 404 | Route không tồn tại |
| `feature_disabled` | 503 | `VITE_API_ENABLED=false` |
| `internal_error` | 500 | Lỗi handler |

Success:

```json
{
  "ok": true,
  "code": "ok",
  "message": "OK",
  "data": { ... },
  "requestId": "uuid"
}
```

## 8. Security notes

1. **Không lưu raw API key** — chỉ `hashed_key` + `key_prefix`
2. **Không đưa secret xuống frontend** — key management qua RBAC `api.manage`
3. **Không dùng service_role bypass RLS** trong runtime API
4. **Prefix + hash verify** — không match chỉ bằng prefix
5. **Audit** — `api_key.created|revoked|used|denied|scope_denied` (localStorage test; Supabase `integration_audit_logs` Phase 11D)
6. **PLAYER** — không có `api.manage`, không quản lý API keys
7. **RLS** — `api_keys` tenant isolation (Phase 11A SQL, unchanged)

## 9. Staging QA checklist

- [ ] Apply SQL: `docs/supabase-sprint10-phase11c-api-key-guard.sql` (staging only)
- [ ] `VITE_API_ENABLED=true` trên Preview
- [ ] `node scripts/verify-phase11c-api-key-guard-staging.mjs`
- [ ] Owner A key → Tenant A OK, Tenant B blocked
- [ ] Owner B key → Tenant B OK, Tenant A blocked
- [ ] Revoked key blocked
- [ ] Scope denied blocked
- [ ] PLAYER không `api.manage`
- [ ] GET `/api/v1/health` public 200
- [ ] Protected routes 401 without key
- [ ] Rate limit 429 khi vượt ngưỡng (test với limit thấp)
- [ ] `npm test` pass
- [ ] `npm run build` pass
- [ ] `npm run lint` pass

## 10. Rollback plan

1. Revert code deploy (Vercel preview)
2. Run `docs/supabase-sprint10-phase11c-rollback.sql` on staging
3. Set `VITE_API_ENABLED=false` nếu cần tắt API layer
4. Xóa test API clients/keys trên staging qua Owner UI hoặc SQL:
   ```sql
   delete from public.api_keys where key_prefix like 'pk_%';
   ```

## 11. Chưa làm (ngoài Phase 11C)

| Hạng mục | Ghi chú |
|----------|---------|
| Payment thật (VNPay/MoMo/Stripe) | Mock only |
| Provider thật (Zalo/SMS/Email) | Design only |
| Production public API | Chưa mở |
| Webhook outbound thật | Placeholder `/webhooks/test` |
| Supabase-backed key store runtime | localStorage/memory; SQL schema sẵn |
| Redis rate limit | In-memory foundation only |
| API key UI management page | RBAC gate sẵn (`canManageApiKeys`) |

## Files chính

| File | Vai trò |
|------|---------|
| `src/features/api/router/edgeApiRouter.js` | Edge router + guard pipeline |
| `src/features/api/guards/apiKeyGuard.js` | API key authentication |
| `src/features/api/guards/rateLimitGuard.js` | Rate limit |
| `src/features/api/utils/edgeApiResponse.js` | Response envelope |
| `src/features/api/constants/edgeApiErrors.js` | Error codes |
| `api/v1/[...path].js` | Vercel entry |
| `tests/phase11c-edge-api-key-guard.test.js` | Unit tests |
| `scripts/verify-phase11c-api-key-guard-staging.mjs` | Staging verify |

## SQL

- **Apply:** `docs/supabase-sprint10-phase11c-api-key-guard.sql` (adds `expires_at`, indexes)
- **Rollback:** `docs/supabase-sprint10-phase11c-rollback.sql`
- **Không tạo bảng mới** — dùng `api_clients`, `api_keys` có sẵn

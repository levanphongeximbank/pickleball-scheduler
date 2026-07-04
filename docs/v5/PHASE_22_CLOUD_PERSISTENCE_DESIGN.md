# Phase 22 — Cloud Persistence Design

**Ngày:** 2026-07-04  
**Branch:** `v5-platform-edition`  
**Phạm vi:** Thiết kế — **không implement toàn bộ trong Phase 21**  
**Mục tiêu:** Loại bỏ phụ thuộc localStorage cho vận hành thương mại multi-staff / multi-device.

---

## 1. Vấn đề hiện tại

| Module | Storage hiện tại | Rủi ro commercial |
|--------|------------------|-------------------|
| Court Engine | `localStorage` — keys `pickleball-court-engine-v1::{tenant}::{clubId}` | Mất data clear cache; không sync staff |
| Club blob | `localStorage` + optional `syncClubToCloud()` → `club_data_v3` | Cloud sync không default; conflict không xử lý |
| Billing | Supabase (`tenant_subscriptions`) | ✅ Cloud-ready |
| Mobile QR | Supabase (`qr_tokens`, `checkins`) | ✅ Cloud-ready (post KN-6) |

Phase 20 đã thêm **tenant-scoped local keys** — cải thiện pilot isolation nhưng **không** giải quyết cloud persistence.

---

## 2. Court Engine — cloud tables đề xuất

### 2.1 Bảng mới (Supabase)

```sql
-- Draft schema — implement Phase 22
court_engine_stores (
  id uuid PK,
  tenant_id text NOT NULL,          -- venues.id
  club_id text NOT NULL,
  payload jsonb NOT NULL,           -- { sessions[], updatedAt }
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz,
  updated_by uuid REFERENCES profiles(id),
  UNIQUE (tenant_id, club_id)
)

court_engine_active_sessions (
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  session_id uuid NOT NULL,
  updated_at timestamptz,
  PRIMARY KEY (tenant_id, club_id)
)
```

### 2.2 RLS

- `tenant_id = user_venue_id()` cho authenticated staff roles.
- `is_super_admin()` bypass.
- Không anon policy.

### 2.3 App layer

| File hiện tại | Thay đổi Phase 22 |
|---------------|-------------------|
| `src/features/court-engine/storage/courtEngineStorage.js` | Repository interface: `LocalCourtEngineStore` + `SupabaseCourtEngineStore` |
| `src/features/court-engine/services/courtSessionService.js` | Inject store qua env `VITE_COURT_ENGINE_STORE=local\|supabase` |

---

## 3. Club cloud persistence

### 3.1 Tái sử dụng hiện có

| Thành phần | Path | Tái sử dụng |
|------------|------|-------------|
| Supabase table | `club_data_v3` | ✅ Đã có — `docs/supabase-club-v3.sql` |
| RLS | `docs/supabase-club-v3-rls.sql` | ✅ Venue-scoped |
| Sync API | `src/ai/cloudSync.js` — `syncClubToCloud()`, `pullClubFromCloud()` | ✅ Logic có — cần wire default |
| Tests | `tests/cloud-sync.test.js` | ✅ Regression base |

### 3.2 Bổ sung cần có

- `club_sync_metadata` — last pull/push timestamp per `(tenant_id, club_id)`.
- Optimistic locking — `version` column trên `club_data_v3` hoặc side table.
- Background sync queue — reuse mobile offline queue pattern nếu có.

---

## 4. Tenant-scoped repository pattern

```
TenantContext (venue_id)
    └── RepositoryFactory
            ├── CourtEngineRepository
            ├── ClubDataRepository
            └── BillingRepository (existing Supabase)
```

**Quy tắc:**

- Mọi query/filter có `tenant_id` từ JWT `profiles.venue_id`.
- Không fallback `default-tenant` khi `VITE_RBAC_ENABLED=true`.
- Service role chỉ server-side jobs.

---

## 5. Offline / local fallback strategy

| Mode | Khi nào | Hành vi |
|------|---------|---------|
| `local` (pilot) | `VITE_COURT_ENGINE_STORE=local` | localStorage only + export backup |
| `supabase` | Production GA | Write-through Supabase; local cache read |
| `hybrid` | Transition | Local first + background push; conflict UI |

**PWA offline:** Cache read-only session snapshot; queue mutations — pattern từ `src/features/mobile/` offline queue.

---

## 6. Migration path localStorage → Supabase

1. User mở Court Engine lần đầu sau upgrade.
2. Detect local payload (`pickleball-court-engine-v1::*`).
3. Prompt owner: "Đồng bộ dữ liệu lên cloud?" (one-time).
4. Upload via RPC `court_engine_import_local` (service validates tenant).
5. Mark local key migrated (`migrated_at` flag).
6. Switch store mode to `supabase`.

**Rollback:** Keep local export 30 days; cloud row soft-delete.

---

## 7. Backup / export path

| Module | Export | Restore |
|--------|--------|---------|
| Court Engine | Existing `exportCourtEngineStore()` in storage | Import RPC Phase 22 |
| Club | Season export + `pullClubFromCloud()` | `syncClubToCloud()` push |
| Billing | Supabase dashboard export | N/A — source of truth cloud |

Pilot interim (Phase 21): owner dùng export JSON manual — `PHASE_20_COURT_ENGINE_PERSISTENCE.md`.

---

## 8. Conflict handling (multi-staff)

| Strategy | Ưu | Nhược |
|----------|-----|-------|
| Last-write-wins + version | Đơn giản | Có thể mất edit |
| Merge sessions array | Giữ nhiều session | Phức tạp |
| Lock session editing | An toàn | UX friction |

**Đề xuất Phase 22 MVP:** Optimistic locking với `version` — conflict → toast "Dữ liệu đã cập nhật bởi người khác — tải lại?".

---

## 9. Test matrix multi-device

| Scenario | Device A | Device B | Expected |
|----------|----------|----------|----------|
| CE-1 | Tạo session | — | B thấy sau refresh |
| CE-2 | Edit assignment | Edit cùng session | Conflict prompt |
| CL-1 | Add player | Pull club | Player sync |
| OFF-1 | Offline edit | Online sync | Queue flush |

Automated: extend `tests/court-engine-storage.test.js` + new `tests/court-engine-cloud.test.js` (mock Supabase).

---

## 10. Phạm vi Phase 22 implementation

| Deliverable | Priority |
|-------------|----------|
| SQL migration court_engine_stores | P0 |
| SupabaseCourtEngineStore | P0 |
| Env flag `VITE_COURT_ENGINE_STORE` | P0 |
| localStorage migration wizard | P1 |
| Club default cloud sync | P1 |
| Conflict UI | P1 |
| Full offline hybrid | P2 |

**Phase 21:** Design only — owner có thể pilot với localStorage + backup nếu chấp nhận B05 limitation.

---

## Tham chiếu code hiện có

| Path | Ghi chú |
|------|---------|
| `src/features/court-engine/storage/courtEngineStorage.js` | localStorage SSOT |
| `src/features/court-engine/ARCHITECTURE.md` | "Supabase sync: localStorage only" |
| `src/ai/cloudSync.js` | Club cloud sync |
| `src/domain/clubStorage.js` | Local club blob |
| `docs/v5/PHASE_20_COURT_ENGINE_PERSISTENCE.md` | Pilot backup |

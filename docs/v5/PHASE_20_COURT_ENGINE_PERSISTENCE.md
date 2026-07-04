# Phase 20 — Court Engine Persistence

**Trạng thái:** **Pilot-safe** (chưa cloud-native hoàn toàn)  
**Ngày:** 2026-07-04

---

## Tóm tắt

Court Engine vẫn lưu session/queue/check-in trên **localStorage**, nhưng Phase 20 đã:

1. **Tenant-scoped keys** — `pickleball-court-engine-v1::{tenantId}::{clubId}`
2. **Legacy migration read** — đọc key cũ `::clubId` nếu key mới trống
3. **RBAC production** — không dùng `default-tenant` khi RBAC bật
4. **Export/import backup** — `exportCourtEngineStore` / `importCourtEngineStore` cho pilot

**Chưa cloud-native:** Supabase repository cho court sessions chưa có trong Phase 20.

---

## Kiến trúc storage

```
localStorage
 └── pickleball-court-engine-v1::{tenantId}::{clubId}   ← Phase 20 (ưu tiên)
 └── pickleball-court-engine-v1::{clubId}              ← legacy (read-only fallback)

Active session:
 └── pickleball-court-engine-active-v1::{tenantId}::{clubId}
```

Module: `src/features/court-engine/storage/courtEngineStorage.js`  
Service: `src/features/court-engine/services/courtSessionService.js` (truyền `tenantId` qua club resolver)

---

## Pilot-safe hay cloud-native?

| Tiêu chí | Phase 20 | Phase 21+ |
|----------|----------|-----------|
| Tenant isolation local | ✅ | ✅ |
| Cloud sync court sessions | ❌ | Đề xuất |
| Club blob `club_data_v3` cloud | Một phần (sync riêng) | Hoàn thiện |
| Backup thủ công | ✅ export/import | Tự động |

---

## Rủi ro còn lại (Phase 20B)

1. **Mất dữ liệu khi xóa browser cache** — owner **bắt buộc** export JSON trước buổi vận hành thật
2. **Đa thiết bị** — hai máy không đồng bộ court session realtime
3. **Club data v3** — players/courts vẫn local-first per club blob
4. **Dev fallback IDs** — `venue-demo` / `tenant-demo` chỉ trong `authService.js` khi RBAC tắt; **staging pilot phải bật RBAC** và dùng owner Supabase thật
5. **`league-1` default** — chỉ trong orchestrator test path (`orchestrator.js`), không ảnh hưởng Court Engine storage key

### Pilot backup (bắt buộc trước vận hành thật)

> ⚠️ **Court Engine vẫn localStorage.** Trước ngày pilot: export backup; sau buổi chơi: export lại nếu có dữ liệu quan trọng.

Trong DevTools Console (staging Preview):

```javascript
import { exportCourtEngineStore } from '/src/features/court-engine/storage/courtEngineStorage.js';
// Hoặc qua support — lưu JSON exportCourtEngineStore(clubId, { tenantId })
```

Lưu file JSON an toàn trước khi clear cache hoặc đổi máy.

---

## Việc đề xuất Phase 21/22

| Phase | Việc |
|-------|------|
| 21 | Supabase table `court_engine_sessions` + RLS tenant |
| 21 | Hydrate court engine từ cloud khi `VITE_SUPABASE` bật |
| 22 | Realtime queue sync; conflict resolution |
| 22 | Gỡ legacy club-only storage keys sau migration |

---

## Tests

`tests/court-engine-storage.test.js` — tenant isolation, reload, backup roundtrip.

```bash
node --test tests/court-engine-storage.test.js
```

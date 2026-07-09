# Data Consistency — Env Flags Runbook

**Mục đích:** Chuẩn hóa biến môi trường liên quan đồng bộ dữ liệu để tránh drift giữa localStorage và Supabase.

---

## Ba flag chính

| Flag | Pilot / Pre-GA (khuyến nghị) | Commercial GA (sau QA) | Ý nghĩa |
|------|------------------------------|------------------------|---------|
| `VITE_CLUB_CLOUD_SYNC` | `false` | `true` | Auto pull khi đổi CLB + debounced push sau `saveClubData` |
| `VITE_COURT_ENGINE_STORE` | `local` | `supabase` | Court Engine: localStorage only vs write-through cloud |
| `VITE_TEAM_TOURNAMENT_SUPABASE` | `false` | `true` (sau migration 23E) | Giải đồng đội: blob only vs cloud + blob mirror |

**Quy tắc:** Mỗi flag phải set **rõ ràng** trên Production. Không dựa vào default ngầm khi có `VITE_SUPABASE_URL`.

---

## Pilot an toàn (1 staff / 1 máy)

```env
VITE_CLUB_CLOUD_SYNC=false
VITE_COURT_ENGINE_STORE=local
VITE_TEAM_TOURNAMENT_SUPABASE=false
```

- Dữ liệu CLB: `pickleball-club-data-v3::{clubId}` (local-first).
- Export JSON định kỳ từ Cài đặt hoặc `buildFullClubExport()`.
- Court Engine không sync giữa thiết bị — chấp nhận limitation pilot.

---

## Staging / Preview (multi-device QA)

Bật từng flag **một**, chạy checklist [`DATA_CONSISTENCY_QA_CHECKLIST.md`](./DATA_CONSISTENCY_QA_CHECKLIST.md):

```env
VITE_CLUB_CLOUD_SYNC=true
VITE_COURT_ENGINE_STORE=supabase
VITE_TEAM_TOURNAMENT_SUPABASE=true
```

**Prerequisite SQL:** Phase 22 (`club_data_v3.version`), court engine tables, team tournament RPC (Phase 23C).

---

## Production GO sequence

1. `VITE_TEAM_TOURNAMENT_SUPABASE=false` — chạy migration blob nếu cần ([`PHASE_23E_PRODUCTION_BLOB_MIGRATION.md`](./PHASE_23E_PRODUCTION_BLOB_MIGRATION.md)).
2. `VITE_CLUB_CLOUD_SYNC=true` — sau QA CL-1 multi-device.
3. `VITE_COURT_ENGINE_STORE=supabase` — sau QA CE-1/CE-2.
4. `VITE_TEAM_TOURNAMENT_SUPABASE=true` — sau Preview smoke PASS.

---

## Rollback nhanh

| Triệu chứng | Hành động |
|-------------|-----------|
| Mất edit local sau đổi CLB | `VITE_CLUB_CLOUD_SYNC=false` → redeploy |
| Court Engine lệch giữa staff | `VITE_COURT_ENGINE_STORE=local` → redeploy |
| Team tournament RPC lỗi | `VITE_TEAM_TOURNAMENT_SUPABASE=false` → app blob-first vẫn chạy |

---

## Liên quan

- [`PHASE_22_CLOUD_PERSISTENCE_DESIGN.md`](./PHASE_22_CLOUD_PERSISTENCE_DESIGN.md)
- [`PHASE_23E_TEAM_TOURNAMENT_CLOUD_SYNC_RUNBOOK.md`](./PHASE_23E_TEAM_TOURNAMENT_CLOUD_SYNC_RUNBOOK.md)
- [`V5_COMMERCIAL_GA_BLOCKER_REGISTER.md`](./V5_COMMERCIAL_GA_BLOCKER_REGISTER.md) — B05, B06

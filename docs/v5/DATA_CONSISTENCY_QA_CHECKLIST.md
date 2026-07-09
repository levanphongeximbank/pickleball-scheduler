# Data Consistency — QA Checklist định kỳ

Chạy sau mỗi lần bật/tắt flag cloud hoặc trước Production deploy.

**Env runbook:** [`DATA_CONSISTENCY_ENV_RUNBOOK.md`](./DATA_CONSISTENCY_ENV_RUNBOOK.md)

---

## 1. Club blob (`club_data_v3`)

| # | Kiểm tra | Pass |
|---|----------|------|
| C1 | `club_data_v3.venue_id` khớp `club.venueId` và `profiles.venue_id` (owner) | ☐ |
| C2 | Không còn row `club_ai_data` cho CLB đã có `club_data_v3` | ☐ |
| C3 | Multi-device CL-1: Device A thêm player → Device B pull thấy player | ☐ |
| C4 | Version conflict: Device A/B cùng sửa → toast cảnh báo, không mất data im lặng | ☐ |
| C5 | Local dirty: sửa offline → đổi CLB không ghi đè khi `VITE_CLUB_CLOUD_SYNC=true` | ☐ |

---

## 2. Court Engine

| # | Kiểm tra | Pass |
|---|----------|------|
| CE-1 | `VITE_COURT_ENGINE_STORE=supabase`: Device B thấy session sau refresh | ☐ |
| CE-2 | Cùng session edit → conflict prompt / version gate | ☐ |
| CE-3 | Migration banner: local sessions → "Đồng bộ lên cloud" thành công | ☐ |

---

## 3. Team tournament

| # | Kiểm tra | Pass |
|---|----------|------|
| TT-1 | `VITE_TEAM_TOURNAMENT_SUPABASE=false` → mutations chỉ blob | ☐ |
| TT-2 | `true` sau migration 23E → blob + cloud row khớp count | ☐ |
| TT-3 | RPC fail → UI cảnh báo `cloudSyncFailed`, blob vẫn dùng được | ☐ |

---

## 4. Pick_VN rating

| # | Kiểm tra | Pass |
|---|----------|------|
| PV-1 | Sample player: global `pick_vn_player_ratings` = blob mirror skill fields | ☐ |
| PV-2 | Club push trả warning nếu RPC Pick_VN fail (không im lặng) | ☐ |

---

## 5. Club registry

| # | Kiểm tra | Pass |
|---|----------|------|
| RG-1 | Pull registry → `pickleball-clubs-v1` merge đúng owner/cluster | ☐ |
| RG-2 | Tạo CLB qua cloud → xuất hiện trong discover/list | ☐ |

---

## 6. Legacy keys (regression)

| # | Kiểm tra | Pass |
|---|----------|------|
| L1 | Sau save tournament/director: không ghi `pickleball-director::*` | ☐ |
| L2 | Không ghi `pickleball-active-slot::*` / `pickleball-tournament-rounds::*` | ☐ |
| L3 | Director locks nằm trong blob `data.director` | ☐ |

---

## Automated tests

```bash
npm run test -- tests/data-consistency.test.js tests/club-sync-metadata.test.js tests/team-tournament-store-mode.test.js
```

---

## Rollback

Xem bảng rollback trong [`DATA_CONSISTENCY_ENV_RUNBOOK.md`](./DATA_CONSISTENCY_ENV_RUNBOOK.md).

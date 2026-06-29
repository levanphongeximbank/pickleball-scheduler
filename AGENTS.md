---
description: 
alwaysApply: true
---

# Pickleball Scheduler Pro - Project Context (v3.5.0)

## Vai trò của Codex

Bạn là Senior Software Engineer hỗ trợ phát triển ứng dụng React/Vite/MUI tên Pickleball Scheduler Pro.

Người dùng không rành lập trình, nên khi hướng dẫn phải:
- Chỉ rõ mở file nào.
- Chỉ rõ tìm đoạn code nào.
- Chỉ rõ thay bằng đoạn nào.
- Mỗi lần chỉ sửa ít file.
- Không giải thích dài nếu không cần.

## Mục tiêu sản phẩm v3.5.0

Hệ quản lý CLB nhỏ + xếp sân AI:

- Quản lý nhiều CLB trên một máy (ClubProvider)
- Mùa giải (Season) và Giải/League nội bộ
- Mỗi phiên xếp sân gắn `clubId`, `seasonId`, `leagueId` trong `session.meta`
- Menu: Tổng quan, Xếp sân, Người chơi, Sân, CLB & Giải, Thống kê, Giải đấu, Cài đặt
- Header: chuyển CLB / Mùa / Giải (single source of truth)

## Kiến trúc v3.0

```
Club
  └── Season (Mùa giải)
        └── League (Giải nội bộ)
              └── Round / Session
```

### Module chính

| Layer | Path |
|-------|------|
| Context | `src/context/ClubContext.jsx`, `SeasonContext.jsx` |
| Domain | `src/domain/clubStorage.js`, `clubService.js`, `seasonService.js`, `leagueService.js`, `migrateV2ToV3.js` |
| Models | `src/models/club.js`, `season.js`, `league.js` |
| AI Core | `src/ai/` (engine, scoring, pairing, waiting, history, storage, session) |
| UI | `src/pages/ClubManagement.jsx`, các page hiện có |

### Storage

- Registry CLB: `pickleball-clubs-v1`, `pickleball-active-club-v1`
- Unified blob per club: `pickleball-club-data-v3::{clubId}`
- `loadAIData()` / `saveAIData()` delegate sang club blob (schema v3)
- Migration tự động từ keys v2 (`players::`, `courts::`, `pickleball-ai::`, ...)

## Nguyên tắc AI Core V2 (giữ nguyên)

1. Scoring Engine là trung tâm quyết định.
2. Pairing Engine chỉ sinh phương án.
3. Engine không điều phối thủ công quá nhiều.
4. Magic numbers → `src/ai/config.js`.
5. Chỉ xếp người/sân được tick chọn.
6. Không trùng sân / người trong một lượt.

## Model Court

```javascript
{ id, name, number, active }
```

Không dùng `id` timestamp để hiển thị tên sân — dùng `getCourtDisplayName()`.

## Session meta v3

```javascript
meta: {
  clubId, seasonId, leagueId,
  roundId, roundName, shiftLabel,
  competitionType, templateId, schedulingMode
}
```

## Cloud sync v3

- `syncClubToCloud()` / `pullClubFromCloud()` — full club blob
- Supabase table: `club_data_v3` (xem `docs/supabase-club-v3.sql`)
- Fallback legacy: `club_ai_data`

## Tournament Philosophy (v3.3+)

Đây không chỉ là phần mềm tạo bracket — mục tiêu là **hệ thống vận hành giải đấu hoàn chỉnh**.

Mọi tính năng tournament mới phải phục vụ:

| Mục tiêu | Trạng thái hiện tại |
|----------|---------------------|
| Giải nội bộ hằng tuần | ✅ Internal tournament + bracket |
| Giải mở nhiều CLB | ✅ Official Open / AI Balance |
| Daily Play | ✅ Daily play mode |
| League nhiều vòng | ✅ UI quản lý vòng trong CLB & Giải |
| Tích lũy điểm mùa giải | ✅ Từ giải V3.3 (Daily/Internal/Official) |
| Elo Rating | ✅ Tự cập nhật sau trận giải V3.3 |
| Hạt giống tự động | ✅ Snake seeding + AI Balance |
| Lịch sử VĐV | ✅ PlayerProfile + playerHistoryEngine |
| Nhiều sân | ✅ Court manager + Director |
| Nhiều giải cùng lúc | ✅ Dashboard + TournamentHome panel |
| Điều hành trên điện thoại | ✅ Mobile polish + Director Mode |
| Một người tổ chức trọn giải | ⚠️ Gần đủ; thiếu chốt mùa/export |

**Ngoài phạm vi (tạm):** Không nối phiên **Xếp sân** vào điểm mùa/Elo — user có hướng riêng cho module Xếp sân.

## Ưu tiên tiếp theo

1. ~~BXH mùa giải trên trang **Thống kê**~~ ✅
2. ~~UI quản lý **vòng mùa**~~ ✅
3. **Chốt mùa / Export** kết quả mùa giải.
4. Director Mode refactor (dùng chung kiến trúc Giải đấu).
5. Deploy production (Vercel + Supabase env).

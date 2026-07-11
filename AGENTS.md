---
description: 
alwaysApply: true
---

# Pickleball Scheduler Pro - Project Context (v3.5.8)

## Vai trò của Codex

Bạn là Senior Software Engineer hỗ trợ phát triển ứng dụng React/Vite/MUI tên Pickleball Scheduler Pro.

Người dùng không rành lập trình, nên khi hướng dẫn phải:
- Chỉ rõ mở file nào.
- Chỉ rõ tìm đoạn code nào.
- Chỉ rõ thay bằng đoạn nào.
- Mỗi lần chỉ sửa ít file.
- Không giải thích dài nếu không cần.

## Mục tiêu sản phẩm v3.5.8

Staging Apply & Manual QA — apply Supabase staging sau Security Hardening v3.5.7, QA theo role, Go/No-Go Vercel Preview. Checklist: `docs/STAGING-APPLY-QA-v358.md`. **Không** deploy production.

## Mục tiêu sản phẩm v3.5.7

Security Hardening — khóa role signup, profile update, Director JWT, tắt dev fallback trên Preview/Production. SQL patch `docs/supabase-security-hardening-v357.sql`. **Chưa** deploy production.

## Mục tiêu sản phẩm v3.5.6

Referee Security Fix — RPC token-scoped (`referee_get_match_by_token`, `referee_update_match_score`); anon không select/update trực tiếp `tournament_match_live`. App referee qua RPC; dev fallback khi chưa RLS. **Chưa** deploy production.

## Mục tiêu sản phẩm v3.5.5

Supabase/RLS staging — SQL + checklist + test plan; RLS `profiles`, `club_data_v3`, `payment_events`, `tournament_match_live`. Referee RPC sẵn sàng.

## Mục tiêu sản phẩm v3.5.4

RBAC production — bật `VITE_RBAC_ENABLED=true`, profile bắt buộc từ `public.profiles`, route/menu/action guard. RLS SQL sẵn sàng trong `docs/`.

## Mục tiêu sản phẩm v3.5.3

Authentication production (Supabase Auth) — đăng nhập/đăng xuất, session restore, route guard. RBAC production tách sang v3.5.4. **Chưa** chạy RLS.

## Mục tiêu sản phẩm v3.5.2

UI/Quality fix sau refactor v3.5.1 — sidebar Xếp sân, UI test harness (AuthProvider), chuẩn bị Authentication production. Không bật RBAC production.

## Mục tiêu sản phẩm v3.5.1

Architecture freeze — chuẩn bị production (Auth, RBAC, Supabase, Deploy). Module mới ưu tiên `src/features/<module>/`.

## Mục tiêu sản phẩm v3.5.0

Hệ quản lý CLB nhỏ + xếp sân AI:

- Quản lý nhiều CLB trên một máy (ClubProvider)
- Mùa giải (Season) và Giải/League nội bộ
- Mỗi phiên xếp sân gắn `clubId`, `seasonId`, `leagueId` trong `session.meta`
- Menu: Tổng quan, Xếp sân, Người chơi, Sân, CLB & Giải, Thống kê, Giải đấu, Cài đặt
- Header: chuyển CLB / Mùa / Giải (single source of truth)

## Kiến trúc v3.5.1 (song song)

- Production: `src/pages/`, `src/router.jsx` (không đổi route).
- Mới: `src/features/<module>/` — copy tách, chuyển import chỉ khi build + test pass và có approval.
- `src/legacy/` — nháp tham chiếu, không thay file production.

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

## Cursor Cloud specific instructions

Frontend-only Vite/React SPA (single app, npm). No backend server, no database, no devcontainer, no git hooks. Runs fully local-first via browser `localStorage`; Supabase, Stripe, RBAC/auth are all optional and OFF by default (`.env.example` empty). No `.env` is required to run/test locally.

Commands (defined in `package.json`):
- Dev server: `npm run dev` (Vite, http://localhost:5173). Only process needed to run the app end-to-end.
- Lint: `npm run lint` (currently passes with 0 errors; ~80 pre-existing `react-hooks/exhaustive-deps` warnings are expected).
- Unit tests: `npm run test` (Node built-in test runner). UI tests: `npm run test:ui` (Vitest + jsdom).
- `npm run test:supabase-referee` only does something when Supabase env vars are set; skip it for local dev.

Node 22 works (Vite 8 needs Node 20.19+ / 22.12+).

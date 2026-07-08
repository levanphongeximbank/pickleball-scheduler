# Pick_VN Player Rating & Skill Verification — Baseline Audit

Phase 30 — mở rộng module skill level hiện có, **không thay thế** VPR Ranking.

## Module hiện có

| Nhóm | File | Vai trò |
|------|------|---------|
| Model | `src/models/player.js` | `skillLevel`, `ratingInternal`, mirrors, `skillLevelLockedAt` |
| Storage | `src/domain/clubStorage.js` | `club_data_v3` blob |
| Đổi trình | `src/domain/skillLevelChangeService.js` | Yêu cầu + duyệt admin |
| Đề xuất | `src/domain/skillLevelService.js`, `skillLevelEngine.js` | Proposal hàng tháng (tắt mặc định) |
| Elo | `eloEngine.js`, `eloService.js` | Cập nhật sau giải có `leagueId` |
| Seeding | `teamPairingEngine.js`, `tournament.seeding.logic.js` | `rating ?? level ?? 3.5` |
| UI | `Players.jsx`, `PlayerProfile.jsx`, `SkillLevelsPage.jsx`, `SkillLevelRequestsPage.jsx` | |
| RBAC | `permissions.js`, `rbac.js` | `skill_level.view_private`, `request_change`, `approve` |
| VPR | `src/features/vpr-ranking/` | BXH giải xác thực — tách biệt |

## DB hiện có

- Skill nằm trong JSON `club_data_v3.data.players[]`
- `public.profiles` không có trường rating
- Không có `self_declared_rating`, `verified_rating`, `rating_status`

## Giữ lại

- `skillLevel` + mirrors làm adapter seeding
- `skillLevelChangeRequests` workflow
- `skillLevelEngine` + Elo cho đề xuất tự động
- VPR module độc lập

## Mở rộng (Phase 30)

- Global canonical: `pick_vn_player_ratings` (Supabase + local fallback)
- Club mirror: flat fields trên `players[]`
- Thang Pick_VN: 2.0 → 6.0+
- Xác thực: CLB / BTC / Admin / System
- Onboarding sau đăng ký PLAYER

## Tách biệt Skill Rating vs VPR

| | Skill Rating | VPR Ranking |
|--|--------------|-------------|
| Mục đích | Trình độ VĐV | Điểm BXH giải |
| Thang | 2.0–6.0+ | Placement points |
| Cập nhật | Khai báo + xác thực + đề xuất | Giải Pick_VN certified |

# Phase MLP — Giải đồng đội 4 người (Major League Pickleball)

## Tổng quan

Preset `mlp_4` trong `src/features/team-tournament/engines/mlpPresetEngine.js` cấu hình:

- Roster: 4 VĐV (2 nam + 2 nữ)
- Tie: Đôi nữ → Đôi nam → Mixed×2 → Dreambreaker (nếu 2-2)
- Scoring: Rally 21, win-by-2, Freeze @20
- Lineup: reuse VĐV trong tie; validate 2 trận/VĐV

## Mapping code

| Điều lệ | Module |
|---------|--------|
| Preset & disciplines | `mlpPresetEngine.js` |
| Roster 4 người | `teamRosterEngine.validateMlpRoster` |
| Lineup 2 trận/VĐV | `lineupValidationEngine.validateMlpLineupParticipation` |
| Rally / Freeze | `rallyScoringEngine.js` → `teamRefereeEngine` |
| Dreambreaker 2-2 | `dreambreakerEngine.js` + `teamResultEngine` |
| Forfeit | `forfeitEngine.js` |
| Captain UI | `TeamPortal.jsx`, `DreambreakerPanel.jsx` |
| Referee UI | `TeamRefereePortal.jsx` |

## Tạo giải

`TournamentHome` → **Giải đồng đội MLP** → `formatPreset: "mlp_4"`.

Giải tùy chỉnh: `settings.formatPreset = "custom"` khi patch teamData.

## QA nhanh

1. Tạo giải MLP, thêm 2 đội × 4 VĐV (2M+2F).
2. Tạo lịch — `lineupLockAt` = giờ đấu − 15 phút.
3. Nộp đội hình (mỗi VĐV 2 trận), khóa, công bố.
4. Trọng tài xác nhận 4 trận; nếu 2-2 → Dreambreaker.
5. BXH cập nhật HS trận con sau từng trận; Trận/T–B sau tie hoàn tất.

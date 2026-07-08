# Phase 29 — Pick_VN VPR Ranking + Certified Tournament Workflow

## Mục tiêu

- Phân loại giải (`tournament_level`) + xác thực Pick_VN (`certification_status`)
- Rule engine tính điểm VPR sau khi BTC xác nhận kết quả
- BXH công khai `/rankings` và quản trị `/dashboard/rankings`
- SQL: [`PHASE_29_RANKING.sql`](./PHASE_29_RANKING.sql)

## Feature flags

```env
VITE_VPR_RANKING_ENABLED=false
VITE_VPR_CLOUD_SYNC=false
```

- **Local dev/tests:** engine + ledger dùng `localStorage` (`vprLocalStore.js`)
- **Staging/production:** bật flag + apply SQL + RPC

## Workflow

1. BTC chọn `tournamentLevel` ∈ certified / vpt_* → `certification_status=pending`
2. Super Admin / Kỹ thuật viên duyệt tại `/admin/tournament-certifications`
3. Sau duyệt: `approved` + `ranking_enabled=true` + badge **Pick_VN Certified**
4. Khi giải xong: BTC bấm **Xác nhận kết quả & kết thúc giải**
5. `vprAwardService.tryAwardTournamentVpr()` cộng điểm theo bảng config

## Module

```
src/features/vpr-ranking/
  constants/     — categories, placements, default point table
  engines/         — placementResolver, vprCalculationEngine
  services/        — certification, award, athlete, leaderboard, audit
  components/      — badge, level select, VPR panel
```

## RBAC

| Permission | Mô tả |
|------------|--------|
| `ranking.view` | Xem BXH admin |
| `ranking.manage` | Recalculate, điều chỉnh điểm |
| `tournament.certify` | Duyệt / từ chối giải |

## Staging QA

1. Tạo giải Official, chọn **VPT 250** → trạng thái chờ duyệt
2. Super Admin duyệt → badge Certified
3. Hoàn tất trận → xác nhận kết quả → kiểm tra ledger + `/rankings`
4. Recalculate tại `/dashboard/rankings`
5. Player Profile → tab VPR

## Giới hạn V1

- Không nhân hệ số số người tham gia (hook = 1.0)
- `open_double` không tính VPR
- Không ảnh hưởng Elo / season standings

## Verify script

```bash
node scripts/verify-phase29-ranking-staging.mjs
```

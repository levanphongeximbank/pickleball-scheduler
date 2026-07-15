# Phase 42N — Athlete ↔ Membership SSOT (PlayerProfile / Verify)

**Branch:** `hotfix/v2-athlete-membership-ssot`  
**Status:** Preview + Owner QA only — **STOP trước merge / Production migration / Production deploy.**

## 1. Kiến trúc SSOT cuối cùng

| Domain | Source of truth |
|--------|-----------------|
| Tài khoản | `auth.users` + `public.profiles` |
| Hồ sơ VĐV chuẩn | `public.athletes` — **1 user → ≤1 athlete** (`athletes_user_uniq` trên `user_id`) |
| Thành viên CLB | `public.club_members` (`user_id` + `athlete_id`, multi-club OK) |
| Roster legacy | `club_data_v3` / local blob — **fallback lịch sử trận**, không tạo mới để “chữa” membership |
| `profiles.club_id` | **Không** dùng làm SSOT (không ghi trong 42N) |

Model được chọn **khớp schema PHASE_42B** (không xung đột): `club_members.athlete_id → athletes.id`, `athletes.user_id → auth.users`.

## 2. Dry-run Production (probe 2026-07-14, read-only)

| Metric | Giá trị |
|--------|---------|
| Memberships `active` + `athlete_id IS NULL` | **10** |
| Distinct `user_id` | **10** |
| Athlete sẽ tạo | **10** (1/user) |
| `athletes` hiện có | 0 |
| `club_data_v3` | 0 (không đụng) |

Bao gồm Hương Nguyễn (`f776d627-…`) / CLB ACCC.

## 3. File thay đổi

- `docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql`
- `docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_SSOT.md` (doc này)
- `src/features/club/services/resolveV2AthleteProfileService.js`
- `src/features/club/services/clubStorageV2RpcService.js` (`rpcPlatformResolveAthleteProfile`)
- `src/features/club/services/platformAthleteService.js`
- `src/features/club/index.js`
- `src/pages/PlayerProfile.jsx`
- `src/features/pick-vn-rating/services/ratingVerificationService.js`
- `src/features/pick-vn-rating/components/PickVnRatingPanel.jsx`
- `tests/v2-athlete-membership-ssot.test.js`

## 4. Migration SQL

Xem `PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql`:

1. Unique partial index `athletes_user_uniq`
2. `phase42n_ensure_athlete_for_user`
3. Backfill `club_members.athlete_id` trong transaction
4. Patch `club_review_membership_request` tạo/link athlete khi approve
5. RPC `platform_resolve_athlete_profile`
6. `club_list_members` thêm `athlete_id` + `email`
7. Rollback notes (comment)

**Không chạy Production trong phase này.**

## 5. RLS

- Không nới SELECT trái phép: `platform_resolve_athlete_profile` = security definer, chỉ Super Admin / chính chủ / governor của CLB mà target là member active.
- `athletes` / `club_members` vẫn revoke INSERT/UPDATE/DELETE với `authenticated`; mutate chỉ qua definer RPC / migration.
- Xác thực rating V2 ghi Pick_VN theo `auth_user_id` (RPC sync sẵn có); không yêu cầu blob.

## 6. Pick_VN cloud (subphase — không backfill trong hotfix)

| Quan sát | Chi tiết |
|----------|----------|
| `pick_vn_player_ratings` Production | **0 rows** |
| UI từng hiện 2.1 | Client local store `pickleball-pick-vn-ratings-v1` và/hoặc mirror trên object player sau assessment; **không** có cloud row tin cậy |
| Khóa chuẩn hiện tại | `auth_user_id` (schema Phase 30) |
| Rủi ro | Đổi máy/trình duyệt → mất provisional nếu chưa sync |
| Quyết định hotfix | **Không** ghi 2.1 lên cloud; tách subphase sync rating sau khi Owner xác nhận nguồn |

## 7. Owner QA — Hương Nguyễn (sau khi Preview + SQL staging đã apply)

URL: `/players/profile/profile-f776d627-a9f2-4c0c-8d81-bda239cc923b`

1. Email đúng `huonganna120193@gmail.com`
2. Badge/thông báo **Thành viên CLB ACCC** (không “Chỉ có tài khoản”)
3. Không dropdown **CLB Mặc định**
4. Không form “Gắn VĐV” khi đã membership
5. Xác thực trình độ: không “Không tìm thấy vận động viên”; club context = ACCC
6. Lịch sử trận có thể trống — lý do không còn “chưa gắn CLB”

**Preview QA note:** Client hotfix có thể soft-degrade nếu RPC chưa deploy (account-only fallback + warning). Để QA đủ, apply SQL lên **Staging** trước, rồi trỏ Preview vào Staging — hoặc Owner duyệt apply Staging only.

## 8. Kế hoạch Production (sau Owner approve riêng)

1. Dry-run queries trong SQL file → lưu output  
2. Backup `athletes` / `club_members`  
3. Apply `PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql`  
4. Post-check `remaining_null_athlete = 0`  
5. Deploy client hotfix  
6. Smoke Hương + 1 member ACCC khác  

**Rollback:** block comment trong SQL (unlink athlete_id + optional delete orphan athletes + restore prior RPC bodies từ backup Phase 42I/42C).

## 9. STOP conditions

- ❌ Merge main  
- ❌ Migration Production  
- ❌ Deploy Production  
- ✅ Code + SQL + tests + Preview / Staging QA  

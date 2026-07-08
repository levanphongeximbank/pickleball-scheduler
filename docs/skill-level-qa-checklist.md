# Checklist test — Pick_VN Player Rating & Skill Verification

Dùng checklist này sau mỗi lần sửa liên quan `pick-vn-rating`, `skillLevel`, `current_rating`, `rating_status`, VPR, onboarding wizard (Phase 31).

**Chuẩn bị**

- [ ] Chạy `npm run dev`, mở CLB có sẵn VĐV và giải cũ (nếu có).
- [ ] Staging Supabase: `qyewbxjsiiyufanzcjcq` — migration `phase_31_pick_vn_onboarding_profile` đã apply.
- [ ] Chạy test:  
  `node --test tests/pick-vn-rating.test.js tests/playerSkillAssessmentEngine.test.js tests/skill-level-change-service.test.js tests/skill-level-engine.test.js tests/skill-level-service.test.js`

**Vai trò test**

| Vai trò | Tài khoản dev gợi ý |
|---------|----------------------|
| Chủ CLB | `club@club.local` |
| VĐV | `player@club.local` |
| Kỹ thuật viên | `kythuat@gmail.com` (V5.2 seed) |

**Staging DB — xác minh nhanh (đã chạy 2026-07-07)**

| Kiểm tra | Kết quả |
|----------|---------|
| `profiles.gender`, `profiles.birth_year` | ✅ |
| `pick_vn_player_ratings.assessment_answers`, `suggested_rating` | ✅ |
| RPC `pick_vn_sync_rating(p_row jsonb)` | ✅ |
| Migration `phase_31_pick_vn_onboarding_profile` | ✅ |

---

## 1. Wizard onboarding Pick_VN (Assessment Engine V1 — 7 bước)

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 1.1 | Đăng ký / đăng nhập PLAYER chưa có assessment | Redirect `/onboarding/pick-vn-rating` | ☐ |
| 1.2 | **Bước 1 — Hồ sơ** — Giới tính, năm sinh (tùy chọn), thời gian chơi, buổi/tuần, HLV | Bắt buộc đủ câu chấm điểm; **Tiếp** tắt nếu thiếu | ☐ |
| 1.3 | **Bước 2 — Thi đấu** | 3 câu single-choice | ☐ |
| 1.4 | **Bước 3 — Nền tảng** | Multi-select môn; `prior_sport_level` chỉ hiện khi không chọn "Không" | ☐ |
| 1.5 | **Bước 4 — Kỹ thuật** (8 câu, chia card) | Validate trước khi tiếp | ☐ |
| 1.6 | **Bước 5 — Chiến thuật** (5 câu) | Validate trước khi tiếp | ☐ |
| 1.7 | **Bước 6 — Tự đánh giá** 1.5–5.0+; DUPR/UTR-P (tùy chọn) | Tự khai **không** quyết định rating cuối | ☐ |
| 1.8 | **Bước 7 — Kết quả** | Hiện rating tạm, score/100, confidence, cảnh báo, giải thích; **không** slider xác nhận | ☐ |
| 1.9 | Bấm **Lưu đánh giá tạm thời** | `current_rating` = `provisional_rating` (sau ×0.8); `self_declared_rating` tách riêng; status `provisional` hoặc `under_review` | ☐ |
| 1.10 | localStorage `pickleball-pick-vn-ratings-v1` | Có `assessmentScore`, `warningFlags`, `provisionalRating` | ☐ |
| 1.11 | localStorage `pickleball-player-rating-assessment-v1` | Có bản ghi assessment V1 | ☐ |
| 1.12 | Đăng nhập lại | Không bắt onboarding lần 2 | ☐ |
| 1.13 | PLAYER chỉ có slider cũ (không assessment) | Vẫn bị bắt làm wizard | ☐ |
| 1.14 | Hồ sơ VĐV → tab Pick_VN | Thấy assessment score, confidence, cảnh báo (nếu có) | ☐ |

**Gợi ý kiểm tra engine (dev console / smoke script):**

```bash
node scripts/smoke-player-rating-onboarding.mjs
```

- Cùng câu trả lời, đổi `gender` → `provisional_rating` **không đổi** (metadata only)
- Thêm DUPR hợp lệ → `rating_confidence` tăng; `provisional_rating` **không đổi**
- Tự khai cao + kỹ năng thấp → `warning_flags` + `under_review`
- Rating thô từ bảng hỏi × **0.8** = rating tạm hiển thị (vd. 3.5 → 2.8)
- Có/không nền tảng thể thao: chênh lệch tối đa ~6 điểm nhóm (đã nén)

---

## 2. Tạo VĐV — nhập trình độ một lần (CLB)

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 2.1 | Chủ CLB → **Người chơi** → **Thêm** → slider 1.5–6.0+ | Slider bước 0.5 | ☐ |
| 2.2 | Lưu VĐV mới | `current_rating` + `rating_status=self_declared` | ☐ |
| 2.3 | **Sửa** VĐV vừa tạo | Không thấy slider trình độ | ☐ |

---

## 3. Tách Skill Rating vs VPR trên hồ sơ

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 3.1 | Mở hồ sơ VĐV | Tab **Trình độ Pick_VN** và **VPR Ranking** | ☐ |
| 3.2 | Tab Pick_VN | Hiện current/self/provisional/verified + badge; assessment score + cảnh báo nếu có | ☐ |
| 3.3 | Tab VPR | Hiện panel VPR (điểm giải), không gộp trình | ☐ |

---

## 4. Xác thực CLB / Admin

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 4.1 | Chủ CLB → hồ sơ VĐV → **Xác thực CLB** | `rating_status=club_verified` | ☐ |
| 4.2 | VĐV yêu cầu đổi trình | Request pending | ☐ |
| 4.3 | Kỹ thuật viên duyệt `/admin/skill-level-requests` | `admin_verified` + audit log | ☐ |

---

## 5. Regression seeding / Elo

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 5.1 | Setup giải AI Balance | Seeding dùng `current_rating` / `skillLevel` | ☐ |
| 5.2 | Kết quả giải có `leagueId` | Elo cập nhật `ratingInternal` | ☐ |
| 5.3 | Daily Play | `current_rating` không đổi từ Daily | ☐ |

---

## 6. Smoke test tự động (Pick_VN Assessment V1)

```bash
node --test tests/pick-vn-rating.test.js tests/playerSkillAssessmentEngine.test.js
node scripts/smoke-player-rating-onboarding.mjs
npm run build
```

| Test | Mô tả |
|------|-------|
| `snapPickVnRating(1.5)` | Trả về `1.5` (không clamp lên 2.0) |
| `completePickVnOnboarding` | Lưu assessment + tắt gate; `provisional` status |
| `applyProvisionalRatingCalibration` | Rating thô × 0.8 |
| `saveSelfDeclaredRating` không assessment | Vẫn `needsPickVnOnboarding=true` |
| Gender không đổi score | Engine V1 metadata only |

---

_Legacy checklist skill-level vẫn áp dụng cho Elo và quyền xem trình — xem phần dưới._

# Checklist test — Điểm trình độ riêng tư & Elo giải đấu (legacy)

Dùng checklist này sau mỗi lần sửa liên quan `skillLevel`, `level`, `rating`, `ratingInternal`, giải đấu hoặc xếp sân.

**Chuẩn bị**

- [ ] Chạy `npm run dev`, mở CLB có sẵn VĐV và giải cũ (nếu có).
- [ ] (Tuỳ chọn) Chạy test tự động:  
  `node --test tests/skill-level-change-service.test.js tests/skill-level-engine.test.js tests/skill-level-service.test.js tests/elo-engine.test.js`

**Vai trò test**

| Vai trò | Tài khoản dev gợi ý |
|---------|----------------------|
| Chủ CLB | `club@club.local` |
| VĐV | `player@club.local` |
| Kỹ thuật viên | `kythuat@gmail.com` (V5.2 seed) |

---

## 1. Tạo VĐV — nhập trình độ một lần

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 1.1 | Chủ CLB → **Người chơi** → **Thêm** → chọn điểm trình độ | Slider hiện nhãn "chỉ nhập một lần" | ☐ |
| 1.2 | Lưu VĐV mới | `skillLevel` + `skillLevelLockedAt` có trong blob | ☐ |
| 1.3 | **Sửa** VĐV vừa tạo | Không thấy slider trình độ; có thông báo đã khóa | ☐ |

---

## 2. Quyền xem điểm trình độ

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 2.1 | VĐV khác / HLV xem **Người chơi** | Thẻ VĐV **không** hiện block Trình độ | ☐ |
| 2.2 | VĐV xem **hồ sơ của mình** | Thấy điểm trình độ | ☐ |
| 2.3 | Chủ CLB xem hồ sơ VĐV thuộc CLB | Thấy điểm trình độ | ☐ |
| 2.4 | BTC mở **setup giải** (Internal/Official/Daily) | Thấy trình độ khi chọn VĐV (nếu có quyền organizer) | ☐ |

---

## 3. Elo chỉ từ giải đấu (không Daily Play)

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 3.1 | Ghi nhận `skillLevel` VĐV trước trận | — | ☐ |
| 3.2 | Nhập kết quả trận **giải nội bộ / bracket** có `leagueId` | `skillLevel` có thể tăng/giảm | ☐ |
| 3.3 | Nhập kết quả trận **Daily Play** | `skillLevel` **không đổi** | ☐ |
| 3.4 | Test tự động | `tests/skill-level-change-service.test.js` (daily skip) pass | ☐ |

---

## 4. VĐV yêu cầu thay đổi — kỹ thuật viên duyệt

| Bước | Thao tác | Kết quả mong đợi | Pass |
|------|----------|------------------|------|
| 4.1 | VĐV → **Hồ sơ** → form **Yêu cầu thay đổi trình độ** | Gửi thành công khi có lý do | ☐ |
| 4.2 | Gửi lần 2 khi còn pending | Bị chặn | ☐ |
| 4.3 | Kỹ thuật viên → `/admin/skill-level-requests` | Thấy hàng chờ | ☐ |
| 4.4 | Bấm **Duyệt** | `skillLevel` cập nhật; request `approved` | ☐ |
| 4.5 | Tạo request khác → **Từ chối** | `skillLevel` không đổi | ☐ |

---

## 5. Regression nhanh (smoke)

```bash
node --test tests/skill-level-change-service.test.js tests/skill-level-engine.test.js tests/skill-level-service.test.js tests/elo-engine.test.js
```

---

## Ghi chú kỹ thuật (Pick_VN)

| Field | Ý nghĩa |
|-------|---------|
| `assessment_answers` | Jsonb wizard 6 bước + DUPR/UTR-P |
| `assessment_score` | Điểm bảng hỏi 0–100 (local V1) |
| `warning_flags` | Cảnh báo mâu thuẫn (local V1) |
| `provisional_rating` | Rating tạm sau engine + hiệu chuẩn ×0.8 |
| `raw_provisional_rating` | Rating thô trước ×0.8 (local V1) |
| `self_declared_rating` | Tự khai bước 6 — không dùng làm điểm cuối |
| `current_rating` | = `provisional_rating` sau onboarding V1 |
| `rating_status` | `provisional` / `under_review` → verified… |
| `profiles.gender` / `birth_year` | Demographics từ bước 1 (metadata) |

Engine: `src/features/player-rating/`  
SQL (cloud phase sau): `docs/v5/PHASE_30_PICK_VN_PLAYER_RATING.sql`, `docs/v5/PHASE_31_PICK_VN_ONBOARDING_PROFILE.sql`

---

## Ghi chú kỹ thuật (legacy skillLevel)

| Field | Ý nghĩa |
|-------|---------|
| `skillLevel` | Điểm trình độ chính thức (riêng tư) |
| `skillLevelLockedAt` | Thời điểm khóa sau lần nhập đầu |
| `skillLevelChangeRequests[]` | Hàng chờ duyệt thay đổi thủ công (VĐV → kỹ thuật viên) |
| `level` / `rating` | Mirror của `skillLevel` (engine cũ) |
| `ratingInternal` | Theo dõi Elo; sau trận giải sync với `skillLevel` |

**Đề xuất tháng cũ** (`skillLevelProposals[]`): tắt mặc định (`enabled: false`). Luồng mới dùng `skillLevelChangeRequests`.

**Ngoài phạm vi:** Module **Xếp sân** không cộng Elo.

---

## Ký xác nhận

| Mục | Người test | Ngày | Pass/Fail |
|-----|------------|------|-----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |

**Tester:** _______________  
**Phiên bản app:** _______________

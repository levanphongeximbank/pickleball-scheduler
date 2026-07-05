# Tournament Open Doubles Fix Report

**Date:** 2026-07-05  
**Scope:** Thêm hạng mục **Đôi tự do** (`open_double`) vào Tournament Engine; giữ nguyên **Đôi nam nữ** (`mixed_double`). Không deploy production.

---

## 1. Đã thêm category nào?

| Internal key | Label UI | Mô tả |
|---|---|---|
| `open_double` | **Đôi tự do** | Không phân biệt giới tính, chỉ cần đủ 2 người hợp lệ |

Alias import: `open_doubles` → `open_double` (tương thích nếu dữ liệu/API dùng dạng số nhiều).

**Không thêm** category mới cho 5 loại còn lại — chúng đã tồn tại:

| Internal key | Label UI |
|---|---|
| `men_single` | Đơn nam |
| `women_single` | Đơn nữ |
| `men_double` | Đôi nam |
| `women_double` | Đôi nữ |
| `mixed_double` | Đôi nam nữ |

**Không dùng** tên "Đôi hỗn hợp" trong codebase (đã xác nhận không có string này trước khi sửa).

---

## 2. "Đôi nam nữ" và "Đôi tự do" khác nhau thế nào?

| | **Đôi nam nữ** (`mixed_double`) | **Đôi tự do** (`open_double`) |
|---|---|---|
| Số người | Đúng 2 | Đúng 2 |
| Giới tính | Bắt buộc **1 nam + 1 nữ** | **Không kiểm tra** giới tính |
| Nam + nam | ❌ | ✅ |
| Nữ + nữ | ❌ | ✅ |
| Nam + nữ | ✅ | ✅ |

---

## 3. Enum / internal key dùng là gì?

Hệ thống tournament dùng **`EVENT_TYPE`** trong `src/models/tournament/constants.js`:

```javascript
EVENT_TYPE.OPEN_DOUBLE = "open_double"
EVENT_TYPE.MIXED_DOUBLE = "mixed_double"  // Đôi nam nữ — không đổi nghĩa
```

Convention: singular (`men_double`, không phải `men_doubles`), thống nhất với 5 loại cũ.  
Alias `open_doubles` được chấp nhận khi normalize dữ liệu cũ/import.

Danh sách UI chuẩn: **`EVENT_TYPE_OPTIONS`** (6 mục, single source of truth).

**Lưu ý:** Court Engine `PLAY_MODE.MIXED_DOUBLES = "mixed_doubles"` là module xếp sân — **không** liên quan tournament category, **không** sửa.

---

## 4. UI nào đã cập nhật?

| Màn hình | File | Thay đổi |
|---|---|---|
| Tạo giải nội bộ + nội dung thi đấu | `InternalTournamentSetup.jsx` | Dropdown dùng `EVENT_TYPE_OPTIONS`, có **Đôi tự do** |
| Tạo giải chính thức + nội dung + đăng ký | `OfficialTournamentSetup.jsx` | Dropdown dùng `EVENT_TYPE_OPTIONS`, có **Đôi tự do** |
| Chia bảng / bốc thăm / lịch / bracket | Không cần sửa riêng | Engine category-agnostic; validation upstream đã xử lý `open_double` |
| Export/import season | Không sửa | `eventType` lưu string — giải cũ `mixed_double` vẫn load bình thường |
| Daily Play | Không sửa | Dùng `DAILY_MATCH_TYPE` riêng (ngoài phạm vi tournament event) |
| Xếp sân / League | Không sửa | Dùng `competitionType` (`doubles_mixed`, `open`, …) — hệ thống song song |

---

## 5. Validation đã đúng chưa?

| Hạng mục | Rule | File |
|---|---|---|
| Đơn nam / nữ | 1 người, đúng giới tính | `validationEngine.js` (giữ nguyên) |
| Đôi nam / nữ | 2 người, cùng giới tính | `validationEngine.js` (giữ nguyên) |
| **Đôi nam nữ** | 2 người, 1M + 1F | `validationEngine.js` |
| **Đôi tự do** | 2 người, không check gender | `validationEngine.js` |
| Đăng ký Official (cặp) | Mixed: bắt 1M+1F; Open: bất kỳ | `officialTournamentEngine.js` → `validateOpenRegistrationPlayers` |
| Chia bảng / draw | `validateGroupDrawInput` → `validateEntryForEvent` | `validationEngine.js` |
| Gợi ý ghép cặp | Open: ghép skill, không ép mixed | `teamPairingEngine.js` |

---

## 6. Test nào đã thêm/sửa?

**File mới:** `tests/tournament-open-doubles.test.js` (13 test cases)

- `EVENT_TYPE_OPTIONS` có đủ 6 loại
- Label **Đôi tự do** / **Đôi nam nữ** đúng
- `open_double`: cho phép M+M, F+F, M+F
- `open_double`: từ chối thiếu / thừa người
- `mixed_double`: vẫn bắt 1M + 1F
- `validateOpenRegistrationPlayers`: mixed vs open
- `normalizeEvent`: alias `open_doubles`
- Legacy `mixed_double` events vẫn hợp lệ
- `suggestEntriesFromPlayers` cho open_double

**Không sửa** test cũ — tất cả pass.

---

## 7. Kết quả test / build / lint

| Command | Kết quả |
|---|---|
| `npm test` | ✅ **769 pass**, 0 fail |
| `npm run build` | ✅ Vite build thành công |
| `npm run lint` | ✅ **0 errors** (128 warnings có sẵn, không liên quan thay đổi này) |

---

## 8. Owner cần test giao diện gì?

### Giải nội bộ (`InternalTournamentSetup`)

1. Dropdown **Loại nội dung** có 6 mục, cuối cùng là **Đôi tự do**.
2. Chọn **Đôi tự do** → chọn VĐV → ghép cặp: thử cặp nam+nam, nữ+nữ, nam+nữ đều được.
3. Chọn **Đôi nam nữ** → cặp nam+nam phải bị chặn khi chia bảng.

### Giải chính thức Open (`OfficialTournamentSetup`)

1. Dropdown có **Đôi tự do**.
2. Tab đăng ký cặp: đăng ký nam+nam / nữ+nữ / nam+nữ với **Đôi tự do** → OK.
3. Đăng ký nam+nam với **Đôi nam nữ** → báo lỗi.
4. Chia bảng → lịch → bracket chạy bình thường với open_double.

### Tương thích dữ liệu cũ

1. Mở giải đã lưu với `mixed_double` → vẫn hiển thị **Đôi nam nữ**, không đổi dữ liệu.

---

## 9. Có ảnh hưởng Phase 19B Controlled Production Runtime Test không?

**Không.**

| Lý do | Chi tiết |
|---|---|
| Không SQL migration | Chỉ sửa app layer (constants, engines, UI, tests) |
| Gate 1/2/3 | Không đụng docs/runbook SQL production |
| Billing / Payment / API / RBAC | Không sửa |
| Court Engine | Không sửa |
| Production deploy | Không thực hiện |
| Dữ liệu Supabase | `eventType` là string trong club blob — không cần schema change |

Phase 19B smoke test có thể chạy như cũ. Nếu Owner muốn verify thêm: tạo giải staging với **Đôi tự do** (optional, không chặn gate).

---

## Files changed

| File | Change |
|---|---|
| `src/models/tournament/constants.js` | `OPEN_DOUBLE`, labels, options, alias |
| `src/models/tournament/event.js` | Normalize alias `open_doubles` |
| `src/models/tournament/index.js` | Export mới |
| `src/tournament/engines/validationEngine.js` | Validation open_double |
| `src/tournament/engines/teamPairingEngine.js` | Filter/pair open_double |
| `src/tournament/engines/officialTournamentEngine.js` | Double types, labels, registration validation |
| `src/pages/tournament/InternalTournamentSetup.jsx` | Dùng `EVENT_TYPE_OPTIONS` |
| `src/pages/tournament/OfficialTournamentSetup.jsx` | Dùng `EVENT_TYPE_OPTIONS` |
| `tests/tournament-open-doubles.test.js` | Test suite mới |

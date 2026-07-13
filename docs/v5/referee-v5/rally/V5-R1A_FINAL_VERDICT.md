# REFEREE V5-R1A — Final Verdict

**Phase:** REFEREE V5-R1A — Rally Scoring Rules Research  
**Date:** 2026-07-13  
**Project:** REFEREE V5-R (Rally Scoring)  
**Branch context:** `feature/referee-v5-rally-scoring` (research only)

---

## REFEREE V5-R1A: COMPLETE

### Official sources

- USA Pickleball 2026 Official Rulebook (Rule 14.A, 15.B.7, 15.C, 15.C.2, 21.B, Section 5)
  - https://usapickleball.org/docs/rules/USAP-Official-Rulebook.pdf
- USA Pickleball 2026 Rulebook Change Document (entry 2242 — bỏ freeze game point)
- Pickleball Canada 2026 Official Rulebook (đồng bộ USAP 14.A)
- European Pickleball Federation — bản đăng USAP 2026 + Change Document
- Major League Pickleball — 2026 MLPlay Rules Guide (5.17.26)
  - https://upaa.unitedpickleball.com/wp-content/uploads/2026/05/2026-MLPlay-Rules-Guide-5.17.26.pdf
- UPA-A 2026 Rulebook V0.8 (side-out mặc định; TO 2.3 Rally option; Appendix E In Progress)
- PPA Tour public rules guide — side-out mặc định (không dùng làm luật Rally doubles)
- APP Tour formats công bố — side-out (không phải nguồn Rally)

### Variants found

- **USAP 2026 Provisional Rally** (singles + doubles, không freeze, one server, win by 2)
- **USAP 2025 Rally + freeze** (game point chỉ khi đang giao) — đã thay thế năm 2026
- **MLP DreamBreaker™ 2026** (singles rally to 21, win by 2, must win while serving, xoay 4 VĐV / 4 điểm)
- **MLP doubles Rally lịch sử** (các mùa trước: rally + freeze) — không còn là luật doubles MLP 2026
- **UPA-A Rally option (singles)** — cho phép theo TD; appendix chi tiết chưa hoàn tất
- **PPA / APP mặc định** — side-out, không phải biến thể Rally để chuẩn hóa first

### Recommended first variant

- **USA Pickleball 2026 Provisional Rally Scoring (Rule 14.A)**
- Ưu tiên **Doubles** cho Team Tournament / giải CLB
- **Không freeze**
- **Không Server 1 / Server 2**
- Điểm mỗi rally → +1 cho bên thắng
- Side-out ngay khi đội giao thua rally
- Win by 2 (mặc định); điểm đích cấu hình 11/15/21
- DreamBreaker **không** nằm trong first variant

### Singles

**SUPPORTED** (theo USAP 14.A; có thể trì hoãn thứ tự triển khai sản phẩm)

### Doubles

**SUPPORTED** (ưu tiên first variant)

### Server 1/2

**NOT USED** (trong USAP Rally 14.A.5 — một server mỗi lượt giao)

### Freeze scoring

**EXCLUDED** (khỏi first variant USAP 2026)

### DreamBreaker

**SEPARATE FORMAT** (không cùng luật Rally doubles cơ bản)

### Owner decisions required

1. Xác nhận first variant = USAP 2026 Rally (không freeze)?
2. Điểm kết thúc mặc định: 11 / 15 / 21?
3. Win by luôn 2, hay cho phép win by 1 trong Team Tournament (USAP 15.C)?
4. Scope sản phẩm đầu: chỉ Doubles hay Doubles + Singles?
5. DreamBreaker để phase riêng sau — xác nhận?
6. Freeze / MLP lịch sử: loại hẳn khỏi R1 hay giữ làm option tương lai?

### R1-B readiness

**YES**

*(Nghiên cứu đủ để bắt đầu R1-B — viết đặc tả luật / rules pack. **R1-B chưa được bắt đầu trong phase này.**)*

### Code changes

**DOCUMENTATION ONLY**

Tài liệu tạo mới:

- `docs/v5/referee-v5/rally/V5-R1A_OFFICIAL_SOURCES.md`
- `docs/v5/referee-v5/rally/V5-R1A_VARIANTS_COMPARISON.md`
- `docs/v5/referee-v5/rally/V5-R1A_RECOMMENDED_FIRST_VARIANT.md`
- `docs/v5/referee-v5/rally/V5-R1A_FINAL_VERDICT.md`

### SQL

**NOT APPLIED**

### Deployment

**NOT PERFORMED**

### Production

**UNTOUCHED**

---

## Tóm tắt dễ hiểu (cho chủ dự án)

Rally Scoring **không chỉ có một luật**. Có ít nhất:

1. **Luật liên đoàn (USAP 2026)** — mỗi rally một điểm, không freeze, doubles chỉ một người giao, phù hợp giải CLB / đồng đội.
2. **DreamBreaker của MLP** — kiểu tiebreaker singles riêng (xoay người, phải giao mới được thắng trận).
3. **Các kiểu cũ có freeze** — gần điểm cuối khó thắng hơn nếu đang nhận bóng.

Phase R1-A khuyến nghị bắt đầu bằng **luật USAP 2026**, vì rõ ràng, chính thức, và phù hợp Team Tournament — **không** bắt đầu bằng DreamBreaker.

---

## Ranh giới phase

| Được phép trong R1-A | Đã làm |
|----------------------|--------|
| Nghiên cứu nguồn chính thức | ✅ |
| So sánh biến thể | ✅ |
| Đề xuất first variant | ✅ |
| Tạo tài liệu | ✅ |

| Cấm trong R1-A | Trạng thái |
|----------------|------------|
| Viết / sửa code | Không làm |
| Migration / deploy / feature flag | Không làm |
| Đọc sâu kiến trúc hiện tại | Không làm |
| Bắt đầu R1-B | Không làm |
| Bắt đầu R2 / engine Rally | Không làm |

---

**End of REFEREE V5-R1A**

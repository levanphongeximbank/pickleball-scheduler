# REFEREE V5-R1A — Recommended First Variant

**Phase:** REFEREE V5-R1A  
**Date:** 2026-07-13  
**Quyết định nghiên cứu (chưa code):** Biến thể Rally đầu tiên nên chuẩn hóa cho Referee V5-R.

---

## 1. Khuyến nghị

**Biến thể đầu tiên đề xuất:**

> **USA Pickleball 2026 Provisional Rally Scoring (Rule 14.A)**  
> ID nội bộ: `V-USAP-2026` / tên sản phẩm đề xuất: **`rally_usap_2026`**

**Ưu tiên triển khai luật (khi sang phase sau):**

1. **Doubles** trước (phù hợp Team Tournament / giải CLB).
2. **Singles** cùng bộ luật điểm (14.A), nhưng có thể xếp hàng đợi sau doubles nếu owner muốn thu hẹp scope R2.

**Không khuyến nghị làm first variant:**

- MLP DreamBreaker™  
- USAP 2025 Rally + freeze  
- MLP doubles Rally lịch sử (freeze @20)

---

## 2. Vì sao chọn USAP 2026 Rally

| Lý do | Giải thích đơn giản |
|-------|---------------------|
| **Chính thức & công khai** | Có trong Official Rulebook; liên đoàn Canada / châu Âu cũng bám khung này |
| **Đủ cho giải đồng đội** | USAP 15.B.7 cho phép team play dùng Rally |
| **Ít phụ thuộc giải pro** | Không cần lineup 4 người xoay như DreamBreaker |
| **Không freeze** | Luật 2026: mọi rally đều có thể kết thúc game → dễ giải thích cho BTC / trọng tài |
| **Không Server 1/2** | Một người giao cho đến khi thua rally → khác rõ side-out truyền thống |
| **Có mốc điểm chuẩn** | 11 / 15 / 21 và đổi sân theo Rule 21.B |

---

## 3. Đặc tả luật đề xuất (ngôn ngữ nghiệp vụ)

### 3.1 Ghi điểm

- Mỗi rally có **đúng một điểm**.
- Đội thắng rally được +1, **không cần** đang giao bóng.
- Không có freeze: đội nhận cũng có thể thắng điểm kết thúc game.

### 3.2 Giao bóng

- Doubles: mỗi lần nhận giao (sau side-out), **chỉ một VĐV** giao cho đến khi đội đó thua một rally.
- Thua rally khi đang giao → **side-out** ngay (không chuyển sang Server 2).
- Sau side-out: đối thủ giao; người giao mới là người đứng **đúng ô phải theo điểm đội** tại thời điểm bắt đầu lượt giao.
- Khi đội giao thắng rally: cùng người giao tiếp tục, **đổi ô giao** (phải ↔ trái) theo điểm mới.

### 3.3 Server 1 / Server 2

- **NOT USED** trong biến thể này.

### 3.4 Người giao / người đỡ

- Vị trí phải/trái theo **điểm của từng đội** (chẵn/lẻ), theo nguyên tắc USAP §5 (áp dụng trừ phần Rally sửa).
- Người đỡ trong doubles: người đứng **chéo sân** với người giao.

### 3.5 Đổi vị trí VĐV

- Khi điểm đội thay đổi, hai VĐV của đội đó đứng đúng ô theo điểm mới (chẵn/lẻ của starting server).
- Không có luật “đổi partner mỗi N điểm” như DreamBreaker.

### 3.6 Điểm kết thúc & win by

- Mục tiêu game mặc định đề xuất cho sản phẩm: **21** (phổ biến với Rally / dễ nhớ), cho phép cấu hình **11** hoặc **15** theo USAP.
- **Win by 2** là mặc định sản phẩm.
- **Win by 1** (USAP cho phép trong team play) → **chờ owner quyết định** có bật hay không.

### 3.7 Freeze

- **EXCLUDED** khỏi first variant.

### 3.8 Đổi sân

- Theo USAP 21.B khi chơi single-game / tie-break:
  - Game 11 → đổi khi một bên đạt **6**
  - Game 15 → đổi khi một bên đạt **8**
  - Game 21 → đổi khi một bên đạt **11**
- Sau đổi sân: **cùng người giao** tiếp tục.

### 3.9 Singles / Doubles

| | First variant |
|--|---------------|
| Doubles | **SUPPORTED** (ưu tiên) |
| Singles | **SUPPORTED** theo luật (có thể trì hoãn UI/engine sau) |

### 3.10 Team Tournament

- **Phù hợp** làm luật điểm cho từng trận đơn / đôi trong tie đồng đội (sub-match).
- **Không** thay thế format DreamBreaker nếu sau này cần tiebreaker kiểu MLP.

### 3.11 DreamBreaker

- **SEPARATE FORMAT** — không nằm trong first variant.

---

## 4. Phạm vi cố ý để sau (không đưa vào R1 first variant)

1. Freeze / “must win on serve” (USAP 2025 hoặc DreamBreaker).
2. Rotation 4 VĐV mỗi 4 điểm.
3. MLP doubles Hybrid 2026 (thực chất side-out cho 4 game chính).
4. Win by 1 mặc định (chỉ bật nếu owner yêu cầu cho team play).
5. Appendix E UPA-A khi còn “In Progress”.

---

## 5. Owner decisions required (trước khi R1-B khóa đặc tả)

Các câu hỏi **bắt buộc owner trả lời** trước khi viết đặc tả kỹ thuật R1-B:

1. **Đồng ý first variant = USAP 2026 Rally (không freeze)?** YES / NO / Sửa
2. **Điểm kết thúc mặc định:** 11 / 15 / **21**?
3. **Win by:** luôn 2, hay cho phép win by 1 trong Team Tournament?
4. **Scope R2 đầu tiên:** chỉ Doubles, hay Doubles + Singles cùng lúc?
5. **DreamBreaker:** xác nhận để phase riêng sau (không gộp R1)?
6. **Freeze scoring:** xác nhận **loại khỏi** first variant, có giữ như option sau không?

---

## 6. Readiness cho R1-B

| Điều kiện | Trạng thái |
|-----------|------------|
| Nguồn chính thức đã thu thập | YES |
| Biến thể đã so sánh | YES |
| First variant đã đề xuất | YES |
| Owner đã chốt câu hỏi §5 | **PENDING** |
| Có thể bắt đầu R1-B (viết rules spec, chưa code) | **YES** sau khi owner trả lời tối thiểu câu 1–3 và 5 |

**R1-B readiness (nghiên cứu):** **YES**  
*(R1-B vẫn chưa được bắt đầu trong lượt này.)*

---

## 7. Trạng thái

| Mục | Giá trị |
|-----|---------|
| Code changes | DOCUMENTATION ONLY |
| SQL | NOT APPLIED |
| Deployment | NOT PERFORMED |
| Production | UNTOUCHED |
| Engine Rally | NOT STARTED |

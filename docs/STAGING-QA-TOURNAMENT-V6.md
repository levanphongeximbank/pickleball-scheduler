# Staging QA — Tournament V6 (Private Pairing / Competition Runtime)

| Field | Value |
|-------|-------|
| PR | [#26](https://github.com/levanphongeximbank/pickleball-scheduler/pull/26) |
| Branch | `feature/team-tournament-v6` |
| HEAD (feature tip) | `779b987` — feat(competition): apply canonical rules to matchup and groups |
| Phases | TT-V6-1 → TT-V6-4 |
| Staging Supabase | `qyewbxjsiiyufanzcjcq` (không đổi schema trong TT-V6) |
| Production | **KHÔNG** merge · **KHÔNG** deploy · **KHÔNG** đổi env Production |

**Mục tiêu:** Manual Staging / Preview E2E cho runtime canonical pairing rules.  
**Ngoài phạm vi:** merge `main`, Production deploy, migration/RLS mới.

---

## 0. Preflight (bắt buộc trước E2E)

### 0.1 PR & CI

| # | Check | Pass? |
|---|--------|-------|
| P1 | PR #26 OPEN, base `main` | ☐ |
| P2 | GitHub Checks PASS (Production CI Gate `verify`) | ☐ |
| P3 | Vercel Preview SUCCESS | ☐ |
| P4 | Working tree local sạch; không merge | ☐ |

### 0.2 Preview URL (chọn một)

| Source | URL |
|--------|-----|
| PR #26 | https://github.com/levanphongeximbank/pickleball-scheduler/pull/26 |
| Netlify deploy preview | https://deploy-preview-26--stirring-bombolone-280231.netlify.app |
| Vercel Preview | Lấy link **Visit Preview** trên PR #26 (Checks → Vercel) |

**Dùng Preview gắn PR #26**, không dùng Production domain.

### 0.3 Runtime flags (Preview / Staging only)

Cả hai phải **ON** trên Preview env (Vercel Project → Settings → Environment Variables → **Preview**):

| Flag | Staging Preview QA | Production |
|------|--------------------|------------|
| `VITE_PRIVATE_PAIRING_RULES_ENABLED` | `true` | giữ `false` / không đổi |
| `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED` | `true` | giữ `false` / không đổi |

Sau khi đổi flag: **Redeploy Preview** (không Redeploy Production).

Xác nhận nhanh trên Preview:

1. Hard-refresh (Ctrl+Shift+R).
2. Login SUPER_ADMIN (hoặc role có menu admin).
3. Menu **Quản trị → Quy tắc ghép cặp riêng** mở được → `/admin/ai-pairing/private-rules`.
4. Flags OFF (control): cùng luồng nhưng **không** gọi RPC active-rules / giữ legacy — tick riêng mục §13.

### 0.4 Tài khoản & dữ liệu tối thiểu

| Role | Mục đích |
|------|----------|
| SUPER_ADMIN / PLATFORM_ADMIN | Admin Private Pairing Rules |
| CLUB_OWNER / Director | Daily Play, Internal/Official, Team MLP |
| (tuỳ chọn) REFEREE | Chỉ regression xem trận — không bắt buộc TT-V6 |

Chuẩn bị pool VĐV:

| Scenario | Gợi ý số lượng |
|----------|----------------|
| Daily Play | ≥ 8–12 VĐV, có Nam/Nữ nếu Mixed |
| Internal Mixed | ≥ 16 VĐV (8M+8F) → 8 cặp → 2–4 bảng |
| Official AI Balance | ≥ 8–16 VĐV cùng nội dung |
| Team MLP | ≥ 8 VĐV (4M+4F) cho 2 đội; tốt hơn 16 VĐV / 4 đội |

### 0.5 Quy ước kết quả

| Ký hiệu | Ý nghĩa |
|---------|---------|
| ✅ Pass | Đúng kỳ vọng |
| ❌ Fail | Lỗi / lệch kỳ vọng — ghi evidence, **không** merge |
| ⏭ Skip | Chưa đủ data / flag OFF có chủ đích |
| Structured error | UI hiện lỗi rõ (`privatePairingError`), **không** lưu lịch/bảng rỗng, **không** báo thành công giả |

---

## 1. Daily Play

| # | Case | Steps (tóm tắt) | Kỳ vọng | ☐ |
|---|------|-----------------|---------|---|
| D1 | Flags OFF baseline | Preview flags OFF → Daily Play → tạo lịch công bằng | Legacy path; không RPC private rules bắt buộc | ☐ |
| D2 | Flags ON club scope | Flags ON → Daily Play CLB **không** `tournamentId` → Tạo trận | Load scope CLB; tạo trận OK hoặc lỗi cấu trúc nếu hard block | ☐ |
| D3 | Hard rule chặn | Active rule `must_not_partner` hard giữa 2 VĐV trong pool → tạo trận | Không tạo phương án vi phạm; có message lỗi nếu bất khả thi | ☐ |
| D4 | Soft prefer | Soft `prefer_partner` → tạo nhiều lần cùng seed nếu có | Kết quả ổn định / ưu tiên đúng hướng; không crash | ☐ |
| D5 | Không mất config | Trigger lỗi hard → quay lại màn hình setup | Config CLB/chọn VĐV còn nguyên; không xóa dữ liệu | ☐ |

**E2E path:** CLB → Giải đấu / Daily Play → chọn VĐV → Tạo trận công bằng.

---

## 2. AI Pairing (Internal / Official doubles)

| # | Case | Steps | Kỳ vọng | ☐ |
|---|------|-------|---------|---|
| A1 | Flags OFF | Internal Setup → Đề xuất cặp, flags OFF | Legacy founder/optimizer; không structured private runtime | ☐ |
| A2 | Flags ON Internal | Internal → đề xuất cặp với rules tournament hoặc club fallback | Canonical runtime; cặp thỏa hard | ☐ |
| A3 | Hard must_not_partner | Rule hard 2 VĐV không được cùng cặp → đề xuất | Hai VĐV không cùng entry | ☐ |
| A4 | Soft prefer_partner | Soft prefer → đề xuất | Điểm/ưu tiên; vẫn có candidate nếu chỉ soft miss | ☐ |
| A5 | Lỗi UI | Gây fatalConflicts → đề xuất | Error rõ; không lưu entries giả | ☐ |

**E2E path:** Internal/Official Setup → chọn VĐV → Đề xuất cặp / AI Balance pairing.

---

## 3. Team MLP

| # | Case | Steps | Kỳ vọng | ☐ |
|---|------|-------|---------|---|
| T1 | Flags OFF | Team Tournament → AI ghép đội MLP | Legacy MLP shape (2M+2F/đội) | ☐ |
| T2 | Flags ON hard | Rule hard `must_not_partner` trong pool → AI ghép | Không cùng đội | ☐ |
| T3 | Opponent rule bị loại khỏi formation | Chỉ có `avoid_opponent` → ghép đội | Formation vẫn chạy (rule đối thủ không áp vào MLP) | ☐ |
| T4 | Group rule bị loại khỏi formation | Chỉ có `different_group` → ghép đội | Formation OK; group rule chưa áp ở bước này | ☐ |
| T5 | Impossible hard | Hard conflict / không đủ giới tính | `privatePairingError`; không tạo đội random | ☐ |

**E2E path:** Giải đồng đội → Roster / AI Pairing dialog → Ghép MLP.

---

## 4. Internal Tournament

| # | Case | Steps | Kỳ vọng | ☐ |
|---|------|-------|---------|---|
| I1 | Plan full | Internal → cặp → chia bảng → lịch vòng bảng | Plan `ok`; có groups + matches | ☐ |
| I2 | Tournament scope rules | Active rules scope = tournamentId giải này | Áp đúng giải; không lấy giải khác | ☐ |
| I3 | Club fallback | Tournament ruleset rỗng + có club rules | Internal được fallback club | ☐ |
| I4 | Hard group rule | Hard `different_group` cho 2 VĐV | Không cùng bảng; hoặc lỗi cấu trúc nếu 1 bảng | ☐ |
| I5 | Hard opponent trên schedule | Hard `must_not_opponent` khiến RR bất khả thi | Không lưu lịch rỗng/thành công giả | ☐ |
| I6 | Regen guard | Sau khi đã có groups/matches → regenerate | Tôn trọng `canRegenerateDraw` / message hiện có | ☐ |

**E2E path:** Tournament Home → Internal Setup → ghép cặp → Xây bảng → xem lịch.

---

## 5. Official Tournament

| # | Case | Steps | Kỳ vọng | ☐ |
|---|------|-------|---------|---|
| O1 | AI Balance plan | Official AI Balance → entries → groups → schedule | Plan OK khi không conflict | ☐ |
| O2 | Không club fallback | Tournament rules empty; club có rules | Official **không** lấy club rules | ☐ |
| O3 | blockedByPolicy | Private personal preference trên Official + chưa allowed | **Dừng**; không baseline ngầm; error policy | ☐ |
| O4 | Open mode schedule | Official Open + opponent hard bất khả thi | Structured error; không merge/deploy | ☐ |
| O5 | Scope isolation | Rules của tournament khác | Không áp vào giải Official đang mở | ☐ |

**E2E path:** Official Setup → AI Balance / Open → xây bảng → kiểm lỗi policy.

---

## 6. Matchup

| # | Case | Steps | Kỳ vọng | ☐ |
|---|------|-------|---------|---|
| M1 | Individual RR | Sau chia bảng Internal | Mỗi bảng có đủ trận RR hợp lệ | ☐ |
| M2 | Team RR | Team giải → tạo lịch vòng tròn | Matchups tạo đủ theo số đội | ☐ |
| M3 | Hard filter matchup | Hard avoid/must_not opponent làm RR invalid | Error `NO_FEASIBLE_MATCHUP` (hoặc message tương đương); không random | ☐ |
| M4 | Soft ranking | Soft prefer_opponent | Thứ tự ưu tiên đổi; không loại candidate chỉ vì soft | ☐ |

---

## 7. Schedule

| # | Case | Steps | Kỳ vọng | ☐ |
|---|------|-------|---------|---|
| S1 | Group stage schedule | Internal/Official sau groups | Matches gắn `groupId`, round, entryA/B | ☐ |
| S2 | Flags OFF parity | Cùng data, flags OFF | Lịch legacy ổn định | ☐ |
| S3 | Không lưu khi fail | Opponent hard fail | Không persist schedule rỗng như thành công | ☐ |
| S4 | Team schedule | Team matchups + court/round labels | Hiển thị đúng; fail hard thì không giả thành công | ☐ |

---

## 8. Group Division

| # | Case | Steps | Kỳ vọng | ☐ |
|---|------|-------|---------|---|
| G1 | Legacy avoid_same_group | Flags OFF + founder avoid same group | Vẫn tách bảng (legacy) | ☐ |
| G2 | Canonical different_group hard | Flags ON | Hai VĐV khác bảng | ☐ |
| G3 | Canonical same_group hard | Flags ON | Hai VĐV cùng bảng | ☐ |
| G4 | Soft group preference | Soft different_group | Ranking bảng đổi; vẫn có plan nếu feasible | ☐ |
| G5 | No feasible plan | Hard different_group với `groupCount=1` | `NO_FEASIBLE_GROUP_PLAN`; không random | ☐ |
| G6 | Team snake groups | Team `assignSeededTeamsToGroups` + hard different_group | Teams chứa 2 VĐV không cùng bảng | ☐ |

---

## 9. Opponent Rules

| # | Case | Hard/Soft | Kỳ vọng | ☐ |
|---|------|-----------|---------|---|
| OR1 | `avoid_opponent` | Hard | Loại matchup; không penalty hữu hạn bù | ☐ |
| OR2 | `must_not_opponent` | Hard | Loại matchup | ☐ |
| OR3 | `must_opponent` | Hard | Chỉ giữ khi đối đầu thỏa | ☐ |
| OR4 | `avoid_opponent` | Soft | Giảm điểm nếu đối đầu | ☐ |
| OR5 | `prefer_opponent` | Soft | Tăng điểm nếu đối đầu | ☐ |
| OR6 | opponent repeat | Soft | `max_opponent_repeat` ảnh hưởng score | ☐ |
| OR7 | Không áp vào team formation | — | Rule opponent không phá MLP | ☐ |
| OR8 | Không áp vào group stage filter | — | Opponent không dùng khi chỉ chia bảng | ☐ |

---

## 10. Private Pairing Rules (Admin + scope)

| # | Case | Steps | Kỳ vọng | ☐ |
|---|------|-------|---------|---|
| R1 | Admin UI | `/admin/ai-pairing/private-rules` | SA mở được; non-SA → 403/ẩn menu | ☐ |
| R2 | Activate club set | Tạo/activate rule set scope CLB | Active rules load khi Daily/Internal fallback | ☐ |
| R3 | Activate tournament set | Scope TOURNAMENT + id giải | Chỉ giải đó nhận rules | ☐ |
| R4 | Không lấy scope khác | Mở giải B khi rules gắn giải A | Giải B không áp rules A | ☐ |
| R5 | Map một lần | Network: 1 lần get active / scope khi prepare | Không double-map payload | ☐ |
| R6 | Disable/archive | Reset về không rule | Runtime legacy/baseline an toàn | ☐ |

---

## 11. fatalConflicts

| # | Case | Cách tạo | Kỳ vọng | ☐ |
|---|------|----------|---------|---|
| F1 | Pairing stop | MUST_PARTNER + MUST_NOT_PARTNER cùng cặp mục tiêu | Dừng trước optimizer; `RULE_SET_CONFLICT` | ☐ |
| F2 | Matchup stop | MUST_OPPONENT + MUST_NOT_OPPONENT cùng cặp | Dừng matchup; không random | ☐ |
| F3 | Group stop | Conflict đối đầu đưa vào group preparation (rule set conflict) | Group plan fail; không bảng giả | ☐ |
| F4 | UI | Trigger từ Internal/Daily | Message rõ; config không mất | ☐ |

---

## 12. blockedByPolicy

| # | Case | Steps | Kỳ vọng | ☐ |
|---|------|-------|---------|---|
| B1 | Official personal preference | Private soft/hard preference trên Official, `allowedByPublishedRules=false` | Dừng; `PRIVATE_RULE_BLOCKED_BY_POLICY` | ☐ |
| B2 | Không strip & continue | Cùng B1 | Không bỏ rule rồi chạy baseline | ☐ |
| B3 | Internal soft path | Cùng loại preference trên Internal | Không hard-stop theo Official policy (Internal drop/continue theo V6-1) | ☐ |
| B4 | Certified/VPR (nếu có trên staging) | Competition class restricted | Cùng hành vi Official | ☐ |

---

## 13. Regression

| # | Area | Case | Kỳ vọng | ☐ |
|---|------|------|---------|---|
| X1 | Flags OFF matrix | Daily + Internal + Official + Team + schedule | Hành vi legacy như trước TT-V6 | ☐ |
| X2 | TT-V6-1 | Live doubles wire | Pass smoke A1–A5 | ☐ |
| X3 | TT-V6-2 | Team MLP | Pass smoke T1–T5 | ☐ |
| X4 | TT-V6-3 | Daily / runAI | Pass smoke D1–D5 | ☐ |
| X5 | TT-V6-4 | Matchup + groups | Pass G/OR/M/S | ☐ |
| X6 | Bracket (không đổi trọng tâm) | Internal có groups đầy đủ → bracket path hiện có | Không regression gãy bracket nếu đã QA trước | ☐ |
| X7 | Mobile shell | Preview trên phone: Daily + Internal draw | Không crash; error readable | ☐ |
| X8 | Lint/build đã CI | PR checks | Giữ PASS; không yêu cầu re-run Production | ☐ |

---

## 14. Staging E2E — hướng dẫn từng bước

### Bước 1 — Mở Preview đúng PR

1. Mở https://github.com/levanphongeximbank/pickleball-scheduler/pull/26  
2. Bấm **View deployment** / link Preview (Vercel hoặc Netlify deploy-preview-26).  
3. Xác nhận URL **không** phải Production.  
4. Hard refresh.

### Bước 2 — Bật flags trên Preview (nếu chưa)

1. Vercel → Project `pickleball-scheduler` → **Settings → Environment Variables**.  
2. Scope **Preview** (không chọn Production):  
   - `VITE_PRIVATE_PAIRING_RULES_ENABLED` = `true`  
   - `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED` = `true`  
3. **Redeploy** deployment của PR #26 (Preview only).  
4. Chờ build xanh → mở lại Preview URL.

### Bước 3 — Login Staging

1. Đăng nhập SUPER_ADMIN staging trên Preview.  
2. Chọn CLB staging có đủ VĐV.  
3. (Khuyến nghị) Mở DevTools → Network; lọc `private_pairing` / RPC active rules khi chạy các bước dưới.

### Bước 4 — Smoke admin rules

1. Vào **Quản trị → Quy tắc ghép cặp riêng** (`/admin/ai-pairing/private-rules`).  
2. Tạo/confirm **active rule set**:  
   - Scope **CLUB** (Daily + Internal fallback).  
   - Scope **TOURNAMENT** gắn `tournamentId` giải test Internal/Official.  
3. Thêm lần lượt (có thể tạo nhiều rule set/draft rồi activate):  
   - Hard `must_not_partner` (AI / Daily).  
   - Soft `prefer_partner`.  
   - Hard `different_group` / Soft `same_group` (group).  
   - Hard `must_not_opponent` hoặc hard `avoid_opponent` (matchup).  
   - Cặp conflict MUST + MUST_NOT (fatalConflicts).  
   - Personal preference trên Official (blockedByPolicy).

### Bước 5 — E2E Daily Play (§1)

1. Mở Daily Play của CLB.  
2. Chọn pool có chứa cặp hard-banned.  
3. Tạo trận → ghi Pass/Fail D1–D5.  
4. Gỡ hard / dùng soft → xác nhận vẫn tạo được trận.

### Bước 6 — E2E AI Pairing + Internal (§2, §4)

1. Tạo/mở Internal tournament draft trên CLB.  
2. Đề xuất cặp (A2–A5).  
3. Xây bảng + lịch (I1–I6, G2–G5, M1, S1–S3).  
4. Chụp màn hình lỗi structured nếu fail (kỳ vọng).

### Bước 7 — E2E Official (§5, §12)

1. Mở Official AI Balance.  
2. Confirm **không** club fallback khi tournament rules empty (O2).  
3. Bật personal private preference → expect **blockedByPolicy** (B1–B2).  
4. Clear/allow theo policy UI nếu có → plan chạy lại khi hợp lệ.

### Bước 8 — E2E Team MLP + Team matchup/groups (§3, §6–§9)

1. Team Tournament → AI ghép MLP (T1–T5).  
2. Chia bảng snake với hard `different_group` trên 2 VĐV thuộc 2 đội khác nhau (G6).  
3. Tạo lịch RR; thử hard opponent làm infeasible (M3, S4).

### Bước 9 — Gates fatalConflicts / policy (§11–§12)

1. Activate rule set conflict → thử Daily / Internal / Group / Matchup.  
2. Confirm dừng + message; không lưu kết quả rỗng.  
3. Official policy block như Bước 7.

### Bước 10 — Regression flags OFF (§13)

1. Tạm set Preview flags về `false` **hoặc** dùng build control (không đụng Production).  
2. Redeploy Preview.  
3. Lặp Daily / Internal suggest / Team MLP / chia bảng: phải giống legacy.  
4. Bật lại `true` nếu còn QA tiếp.

### Bước 11 — Sign-off

Điền bảng dưới. **Chỉ** đánh GO Staging QA khi không có ❌ P0.

| Gate | Result | Notes |
|------|--------|-------|
| Preflight P1–P4 | ☐ | |
| Daily Play D1–D5 | ☐ | |
| AI Pairing A1–A5 | ☐ | |
| Team MLP T1–T5 | ☐ | |
| Internal I1–I6 | ☐ | |
| Official O1–O5 | ☐ | |
| Matchup M1–M4 | ☐ | |
| Schedule S1–S4 | ☐ | |
| Group G1–G6 | ☐ | |
| Opponent OR1–OR8 | ☐ | |
| Private Rules R1–R6 | ☐ | |
| fatalConflicts F1–F4 | ☐ | |
| blockedByPolicy B1–B4 | ☐ | |
| Regression X1–X8 | ☐ | |

**Verdict Staging QA:** ☐ GO · ☐ NO-GO  

**Cấm:** Merge PR #26 · Deploy Production · Đổi env Production.

---

## 15. Evidence đề xuất

Lưu (local hoặc `docs/v5/qa-evidence/phase-tt-v6-staging/` nếu owner yêu cầu commit sau):

- Screenshot UI lỗi `fatalConflicts` / `blockedByPolicy` / `NO_FEASIBLE_*`  
- Network log RPC `private_pairing_get_active_rules_for_scope` (scope_type / scope_id)  
- Ghi note Preview URL + thời điểm redeploy flags  
- File này đã tick Pass/Fail

---

## 16. Liên hệ tài liệu

| Doc | Vai trò |
|-----|---------|
| `docs/v5/PRIVATE_PAIRING_RULES_V2_STAGING_QA.md` | Staging QA nền tảng rules/RPC/admin |
| `docs/v5/PRIVATE_PAIRING_RULES_V2_PR5_UI_QA.md` | Admin UI chi tiết |
| PR #26 Description | Scope TT-V6-1…4 + safety |
| Unit suites | `tests/private-pairing-rules-tt-v6-*.test.js` (đã CI PASS) |

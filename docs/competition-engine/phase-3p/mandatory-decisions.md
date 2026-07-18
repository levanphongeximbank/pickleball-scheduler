# Mandatory Decisions — Phase 3P (§26)

Clear answers required by Owner instruction. Not vague.

| # | Question | Official answer (Owner-locked 2026-07-18) |
|---|----------|---------------------------------------------|
| 1 | Có thể bắt đầu bao nhiêu Chat song song? | **4** (3 capability + 1 Integrator). Không mở 6+ lúc đầu. |
| 2 | Chat nào bắt đầu trước? | **Phase 3A.3 (Wave 0 / Chat I)** trước; sau đó **Chat 1 — Phase 3B**. |
| 3 | Chat nào phải chờ? | Capability chats chờ **Phase 3A.3** xong. **3C** chờ 3B merge. **3E** chờ 3D merge. **3G** ưu tiên sau 3F. **3H** Production-parity sau 3G. **3L** sau Draw+Schedule. **3M/3N** sau Owner cutover gates. |
| 4 | Phase 3B và 3C có thể làm song song không? | **NOT ALLOWED initially.** 3B must merge before 3C. |
| 5 | Phase 3D và 3E có thể làm song song không? | **NOT ALLOWED by default.** 3D must merge before 3E. |
| 6 | File nào được bảo vệ? | Root `competition-core/index.js`, runtime-control barrels/resolvers, featureFlags, legacyAdapter, participants barrels, `unit-test-files.json`, architecture-lock scripts/baseline, package manifests. Chi tiết: `shared-file-protection.md`. |
| 7 | Chat nào sở hữu file chung? | **CHAT I — INTEGRATOR** only |
| 8 | Test manifest xử lý thế nào? | **Option D**: mỗi phase có `unit-test-files.phase-3x.json`; capability **không** sửa official manifest; Integrator merge vào `unit-test-files.json`. |
| 9 | Public index xử lý thế nào? | **Option B**: capability-local `index.js`; Integrator re-export root. |
| 10 | Merge theo bao nhiêu wave? | **7** (Wave 0 = Phase 3A.3 … Wave 6). |
| 11 | Có cần Phase 3A.3 trước Phase 3B không? | **YES — REQUIRED.** Official name: **PHASE 3A.3 — INTEGRATION BOOTSTRAP** (Wave 0). |
| 12 | Có cần Integrator Chat không? | **CÓ — bắt buộc.** |
| 13 | Rủi ro lớn nhất là gì? | (1) Conflict/`participants/*` co-location cho 3B–3E; (2) Lifecycle/Elo Production side effects ở 3J; (3) Shared index + manifest thrash nếu không có Integrator. |
| 14 | Điều kiện Owner được phép mở Chat 2–6? | Checklist `parallel-start-checklist.md` **all green**; Phase 3A.3 complete; Wave assignment rõ; không mở 6 capability chats cùng lúc trừ exception. |

## Parallelizable / non-parallelizable summary

| Class | Pairs / phases |
|-------|----------------|
| Parallelizable | 3C∥3D; 3E∥3F (sau 3D merge); 3I∥3J; 3H∥3K với fixtures; 3G∥3H(fixtures) |
| Non-parallelizable (Owner-locked) | **3B→3C**; **3D→3E**; Phase 3A.3 before 3B; 3F→3G (merge); 3G→3H (prod parity); 3M/3N |
| Conditional (other pairs) | 3F∥3G; 3H∥3I; 3J∥3K; 3K∥3L |

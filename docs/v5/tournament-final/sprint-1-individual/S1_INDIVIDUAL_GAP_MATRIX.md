# S1 — Individual Tournament: Gap Matrix

**Sprint:** Tournament V5 Sprint 1  
**Date:** 2026-07-14  
**Status legend:** COMPLETE | PARTIAL | NOT STARTED | OUT OF SCOPE V5

Priority: **P0** = pilot blocker · **P1** = production blocker or core DoD · **P2** = polish · **P3** = defer post-S1

---

## Area 1 — Khởi tạo giải

| Item | Status | Gap ID |
|------|--------|--------|
| Tạo giải cá nhân | PARTIAL | — |
| Chọn đơn nam/nữ, đôi nam/nữ, đôi nam nữ, đôi tự do | COMPLETE | — |
| Nhiều nội dung trong cùng giải | PARTIAL | S1-GAP-011 |
| Giới hạn trình độ, độ tuổi, giới tính, số lượng | COMPLETE (S1-C) | S1-GAP-003 |
| Thời gian đăng ký | COMPLETE (S1-B) | S1-GAP-002 |
| Lệ phí | COMPLETE (S1-C) | S1-GAP-009 |
| Điều lệ | COMPLETE (S1-C) | S1-GAP-010 |
| Trạng thái nháp | COMPLETE | — |
| Mở đăng ký | COMPLETE (S1-B) | S1-GAP-002 |
| Đóng đăng ký | COMPLETE (S1-B) | S1-GAP-002 |
| Đang thi đấu | PARTIAL | — |
| Hoàn tất | COMPLETE | — |
| Hủy | COMPLETE | — |

---

## Area 2 — Đăng ký

| Item | Status | Gap ID |
|------|--------|--------|
| VĐV đăng ký cá nhân | COMPLETE (S1-B) | S1-GAP-005 |
| Cặp đôi đăng ký | COMPLETE (S1-B) | — |
| Mời và xác nhận đồng đội | COMPLETE (S1-B) | S1-GAP-005 |
| BTC thêm thủ công | COMPLETE | — |
| Duyệt, từ chối, danh sách chờ | COMPLETE (S1-B) | S1-GAP-004 |
| Hủy đăng ký | COMPLETE (S1-B cancel + S1-G withdrawal) | S1-GAP-072 |
| Đổi đồng đội trước khi khóa | COMPLETE (S1-B) | S1-GAP-006 |
| Chặn trùng nội dung / xung đột lịch | COMPLETE (S1-C cross-event; schedule conflict soft/later) | S1-GAP-007 |
| Rating V5 eligibility | COMPLETE (S1-C consume snapshot; no V5 module edit) | S1-GAP-008 |
| Thanh toán / trạng thái phí | COMPLETE (S1-C) | S1-GAP-009 |

---

## Area 3 — Seeding & Draw

| Item | Status | Gap ID |
|------|--------|--------|
| Seed theo Rating V5 | COMPLETE (S1-D) | S1-GAP-301 |
| Seed thủ công | PARTIAL | S1-GAP-302 |
| Random draw | COMPLETE | — |
| Chia bảng cân bằng | COMPLETE | — |
| Tránh cùng CLB gặp sớm (cấu hình) | PARTIAL | S1-GAP-306 |
| Bye | PARTIAL | S1-GAP-307 |
| Khóa và công bố kết quả bốc thăm | COMPLETE (S1-A) | S1-GAP-303 |
| Audit log khi BTC chỉnh sửa | COMPLETE (S1-A) | S1-GAP-304 |
| Tạo lại trước publish | COMPLETE (S1-A) | S1-GAP-305 |

---

## Area 4 — Thể thức thi đấu

| Item | Status | Gap ID |
|------|--------|--------|
| Round Robin | COMPLETE | — |
| Vòng bảng → Knockout | COMPLETE | — |
| Knockout trực tiếp | PARTIAL | S1-GAP-402 |
| Tranh hạng ba | COMPLETE (S1-G) | S1-GAP-401 |
| Chung kết | COMPLETE | — |
| Swiss | OUT OF SCOPE V5 | S1-GAP-403 |
| Double Elimination | OUT OF SCOPE V5 | S1-GAP-404 |

---

## Area 5 — Lịch & sân

| Item | Status | Gap ID |
|------|--------|--------|
| Sinh lịch thi đấu | COMPLETE | — |
| Phân sân | COMPLETE (S1-E) | — |
| Tránh VĐV/cặp đánh trùng giờ | COMPLETE (S1-E hard conflict) | S1-GAP-505 (CC-09 default = P2 remaining) |
| Thời gian nghỉ tối thiểu | COMPLETE (S1-E) | S1-GAP-501 |
| Đổi sân / đổi giờ | COMPLETE (S1-E minimal ops) | S1-GAP-503 |
| Hoãn trận | PARTIAL | S1-GAP-504 |
| Xử lý xung đột | COMPLETE (S1-E warnings/errors) | S1-GAP-505 (CC-09 default = P2) |
| Khóa và publish lịch | COMPLETE (S1-E) | S1-GAP-502 |

---

## Area 6 — Trọng tài & kết quả

| Item | Status | Gap ID |
|------|--------|--------|
| Phân công trọng tài | PARTIAL | S1-GAP-061 |
| Nhập điểm | PARTIAL | S1-GAP-062 |
| Xác nhận kết quả | PARTIAL | S1-GAP-063 |
| Walkover | COMPLETE (S1-F types + S1-G workflow) | S1-GAP-064 |
| Retirement | PARTIAL (S1-F result type) | S1-GAP-065 |
| Disqualification | PARTIAL (S1-F result type) | S1-GAP-066 |
| Sửa kết quả có kiểm soát | COMPLETE (S1-F) | S1-GAP-067 |
| Audit log | PARTIAL | S1-GAP-068 |
| Propagation bảng xếp hạng / bracket | COMPLETE (S1-F blob) | S1-GAP-063 |
| Không double-count | COMPLETE (S1-F blob) | S1-GAP-069 |

---

## Area 7 — Xếp hạng & tie-break

| Item | Status | Gap ID |
|------|--------|--------|
| Trận thắng / thua | COMPLETE | — |
| Điểm | COMPLETE | — |
| Hiệu số | COMPLETE | — |
| Head-to-head | COMPLETE (S1-D STANDINGS_V2) | S1-GAP-070 |
| Tie-break nhiều đội | COMPLETE (S1-D mini-table) | S1-GAP-071 |
| Forfeit / withdrawn | COMPLETE (S1-G) | S1-GAP-072 |
| Xếp hạng cuối cùng | COMPLETE (S1-G) | S1-GAP-073 |
| Huy chương | COMPLETE (S1-G) | S1-GAP-074 |
| Đồng hạng (cấu hình) | NOT STARTED | S1-GAP-075 |

---

## Area 8 — Rating V5 integration

| Item | Status | Gap ID |
|------|--------|--------|
| Rating đầu vào | PARTIAL | S1-GAP-080 |
| Kiểm tra eligibility | COMPLETE | — |
| Rating dùng cho seeding | COMPLETE (S1-D) | S1-GAP-081 |
| Kết quả trận hợp lệ | COMPLETE | — |
| Rating event sau trận | PARTIAL | S1-GAP-082 |
| Không cập nhật demo/hủy/không hợp lệ | COMPLETE | — |
| Idempotency | PARTIAL | S1-GAP-083 |
| Reliability / confidence | PARTIAL | S1-GAP-084 |

---

## Area 9 — UX/UI

| Item | Status | Gap ID |
|------|--------|--------|
| BTC desktop | PARTIAL | — |
| BTC mobile | PARTIAL | S1-GAP-090 |
| VĐV mobile | NOT STARTED | S1-GAP-091 |
| Trang công khai | NOT STARTED | S1-GAP-092 |
| Empty / loading / error state | PARTIAL | S1-GAP-093 |
| Confirmation dialog | PARTIAL | — |
| Touch target | PARTIAL | — |
| Responsive | PARTIAL | — |
| Bracket readability | PARTIAL | — |
| Bảng xếp hạng dễ hiểu | PARTIAL | S1-GAP-094 |

---

## Area 10 — Security & reliability

| Item | Status | Gap ID |
|------|--------|--------|
| RLS | PARTIAL | — |
| Cross-tenant isolation | PARTIAL | — |
| Organizer permission | PARTIAL | — |
| Referee permission | PARTIAL | S1-GAP-100 |
| Player self-scope | PARTIAL | S1-GAP-091 |
| Result correction permission | NOT STARTED | S1-GAP-067 |
| Realtime | PARTIAL | S1-GAP-101 |
| Reconnect / polling fallback | PARTIAL | S1-GAP-101 |
| Duplicate submission protection | PARTIAL | S1-GAP-069 |
| Version conflict | PARTIAL | S1-GAP-102 |
| Offline / degraded | PARTIAL | S1-GAP-103 |

---

## Gap register (detailed)

### P0 — Pilot blockers

| ID | Mô tả | Ảnh hưởng | File / module | Cách sửa đề xuất | Test bắt buộc | Phụ thuộc | Pilot | Production |
|----|-------|-----------|---------------|------------------|---------------|-----------|-------|------------|
| **S1-GAP-001** | Không có domain module V5 Individual Tournament (service, SQL, RPC) | Không cloud sync, không multi-device SSOT | `tournamentService.js` blob-only vs `PHASE_23_TEAM_TOURNAMENT.sql` | Thiết kế `individual_tournament_*` tables + repository hoặc mở rộng competition-core blob sync | Integration test cloud round-trip | Competition Core merge | **Yes** | Yes |
| **S1-GAP-002** | ~~Thiếu registration window~~ **CLOSED S1-B** | BTC không gate đăng ký theo thời gian | `registrationEngine.js`, setup ops panel | ✅ `opensAt`/`closesAt` + READY/draw publish lock | T-S1-B01 | — | Yes | Yes |
| **S1-GAP-301** | ~~Seeding không dùng Rating V5~~ **CLOSED S1-D** | Seed sai với Pick_VN rating chính thức | `ratingV5SeedAdapter.js`, `seedEngine.js` | ✅ Prefer display_rating + reliability; Elo/skill fallback | T-S1-D01–D02 | — | Yes | Yes |
| **S1-GAP-303** | ~~Thiếu draw lock/publish cho individual~~ **CLOSED S1-A** | BTC redraw sau công bố; VĐV không tin cậy bracket | `publishDrawEngine.js`, setup pages, `EngineDrawTab.jsx` | ✅ Implemented blob-first publish/lock/reopen | `individual-tournament-draw-publish.test.js` | — | Yes | Yes |
| **S1-GAP-308** | ~~Tournament Engine UI gọi platform stub~~ **CLOSED S1-A** | Engine 4.0 tabs hiển thị dữ liệu giả | `useTournamentEngine.js` | ✅ Wired to real orchestrator | T-S1-A01 + `tournament-engine.test.js` | None | Yes | Yes |
| **S1-GAP-502** | ~~Schedule publish/lock chỉ có team~~ **CLOSED S1-E** | Individual không có lifecycle công bố lịch | `tournament/engines/publishScheduleEngine.js`, `TournamentPublishSchedulePage.jsx` | ✅ Individual draft→lock→publish + immutable snapshot | T-S1-E02 | S1-GAP-303 | Yes | Yes |
| **S1-GAP-061** | ~~Phân công TT mock page~~ **CLOSED S1-F** | Menu route trỏ demo team data | `TournamentRefereeAssignPage.jsx`, `RefereeAssignPanel.jsx` | ✅ Real individual assign + auto/manual/reassign | T-S1-F05 + page regression | S1-GAP-100 | Yes | Yes |
| **S1-GAP-062** | Referee V5 chưa tích hợp individual | Classic scoreboard only — không rally/court V5 | Classic `/referee/:token` + portal tab | ✅ Classic path + assignment token links for pilot; Referee V5 individual deferred | Referee portal smoke | Referee V5 staging | Yes | Yes |
| **S1-GAP-063** | ~~Propagation client-only (blob)~~ **CLOSED S1-F (blob pilot)** | Multi-device conflict; standings/bracket drift | `resultPropagationEngine.js` | ✅ Blob propagate + liveStandings + commandId | T-S1-F01–F03 | S1-GAP-001 | Yes | Yes |
| **S1-GAP-067** | ~~Không có correction workflow~~ **CLOSED S1-F** | Sai sót kết quả không sửa được có kiểm soát | `resultCorrectionEngine.js` | ✅ request/approve/reject + recompute | T-S1-F04 | S1-GAP-063 | Yes | Yes |
| **S1-GAP-080** | Rating V5 singles chưa implement | Đơn nam/nữ không có rating chính thức | `pick-vn-rating-v5/`, `V5-B2_UI_ARCHITECTURE.md` | Ship singles assessment OR gate singles IT until V5-B singles | Rating V5 singles tests | Rating V5 wave | Yes* | Yes |
| **S1-GAP-081** | ~~Seeding không đọc Rating V5~~ **CLOSED S1-D** | Mismatch seed vs eligibility | `ratingV5SeedAdapter.js` | ✅ Same consume path as S1-GAP-301 | T-S1-D01–D02 | — | Yes | Yes |
| **S1-GAP-100** | ~~Referee auth token/name-match only~~ **CLOSED S1-F (blob soft)** | Không assignment-row scoped như TT5-D | `refereeAssignEngine.assertAssignmentScope` | ✅ Blob `settings.refereeAssignments` scoped to match | T-S1-F05 | S1-GAP-062 | Yes | Yes |

*S1-GAP-080 blocks singles pilot only; doubles individual can pilot without it.

### P1 — Core DoD / production blockers

| ID | Mô tả | Ảnh hưởng | File / module | Cách sửa | Test | Phụ thuộc | Pilot | Prod |
|----|-------|-----------|---------------|----------|------|-----------|-------|------|
| **S1-GAP-003** | ~~Eligibility rules chưa persist~~ **CLOSED S1-C** | Age/skill/gender caps không enforce | `individual-tournament/engines/eligibilityEngine.js` | ✅ Blob + gate | T-S1-C01/C02 | — | No | Yes |
| **S1-GAP-004** | ~~Entry workflow~~ **CLOSED S1-B** | Không duyệt đăng ký | `entry.js`, `registrationEngine.js` | ✅ pending/approved/rejected/waitlisted/cancelled | T-S1-B02, B03 | — | No | Yes |
| **S1-GAP-005** | ~~Player self-registration + partner invite~~ **CLOSED S1-B** | VĐV phụ thuộc BTC | `IndividualRegistrationPage.jsx` | ✅ Self-reg + invite token | T-S1-B04 | — | No | Yes |
| **S1-GAP-006** | ~~Đổi partner trước lock~~ **CLOSED S1-B** | Không self-service doubles | `changePartner()` in registrationEngine | ✅ Blocked after lock | Engine unit | — | No | Yes |
| **S1-GAP-007** | ~~Cross-event duplicate~~ **CLOSED S1-C** | VĐV đăng ký trùng nội dung | `registrationValidation.js` | ✅ Hard gate cross-event | T-S1-C03 | — | No | Yes |
| **S1-GAP-008** | ~~Rating V5 eligibility gate~~ **CLOSED S1-C** | Manual verify only | eligibility `rating` rules + player snapshot | ✅ Consume display rating; no V5 edits | Unit | — | No | Yes |
| **S1-GAP-009** | ~~Individual entry fees~~ **CLOSED S1-C** | Không thu phí individual | `entryFeeEngine.js` | ✅ Fees + unpaid→block approve | T-S1-C04 | — | No | Yes |
| **S1-GAP-010** | ~~Config pages team demo~~ **CLOSED S1-C** | Menu misleading | config pages + selector | ✅ Persist individual blob | T-S1-C05 | — | No | Yes |
| **S1-GAP-011** | Internal single-event only | CLB không multi-event | `InternalTournamentSetup.jsx` | Multi-event internal support | `tournament-internal.test.js` extend | None | No | No |
| **S1-GAP-012** | ~~Nav `?event=` ignored~~ **CLOSED S1-B** | UX broken preselect | Type/create/setup pages | ✅ `resolveEventTypeFromQuery` | T-S1-B06 | None | No | No |
| **S1-GAP-013** | No cloud persistence registrations | Data loss on multi-device | club blob only | S1-GAP-001 cloud module | Cloud sync tests | S1-GAP-001 | No | Yes |
| **S1-GAP-302** | Manual seed BTC UI missing | BTC cannot override seed | `EngineSeedTab.jsx` | Editable seed grid + persist | Manual seed tests | S1-GAP-308 | No | No |
| **S1-GAP-304** | ~~Draw edit audit insufficient~~ **CLOSED S1-A** | Không trace BTC edits | `engineRunLog.js`, `workflowHistory.js`, `settings.draw.auditLog` | ✅ Actor + before/after | T-S1-A04 + audit tests | — | No | Yes |
| **S1-GAP-305** | ~~Regenerate-before-publish undefined~~ **CLOSED S1-A** | Redraw after publish risk | setup pages, `publishDrawEngine.js` | ✅ Guard on publish + forceRedraw | T-S1-A02, T-S1-A03 | — | No | Yes |
| **S1-GAP-401** | ~~Third-place match not generated~~ **CLOSED S1-G** | Tranh H3 thiếu trận | `thirdPlaceEngine.js` | ✅ Optional generate + SF loser sync | T-S1-G03 | None | No | No |
| **S1-GAP-402** | Knockout-only format unavailable | Không giải KO thuần | format config | Format selector + direct KO path | Format tests | None | No | No |
| **S1-GAP-501** | ~~Min rest not enforced in schedule engine~~ **CLOSED S1-E** | VĐV fatigue / unfair schedule | `scheduleEngine.js`, `restTimeEngine.js` | ✅ Per-player min-rest + auto-adjust + fail hard | T-S1-E01 | None | No | Yes |
| **S1-GAP-503** | ~~BTC per-match court/time change UI~~ **CLOSED S1-E** | Reschedule manual only via director | `ScheduleBuilderPanel.jsx` | ✅ Minimal match ops + rest warnings | T-S1-E03 + panel | None | No | No |
| **S1-GAP-064** | ~~Walkover UI missing~~ **CLOSED S1-F (engine+monitor)** | Cannot record WO | `matchResultEngine.js`, `MatchResultMonitorPanel.jsx` | ✅ WO/retirement/injury/DQ via result types | walkover unit in S1-F suite | S1-GAP-063 | No | Yes |
| **S1-GAP-068** | Shallow audit on classic path | Compliance gap | `scoreLog.js` | Rally/event audit or Referee V5 | Audit tests | S1-GAP-062 | No | Yes |
| **S1-GAP-069** | ~~No server idempotency on finalize~~ **CLOSED S1-F (blob pilot)** | Double-count risk | `resultPropagation.processedCommandIds` | ✅ Durable command ids on tournament blob | T-S1-F01 | S1-GAP-063 | No | Yes |
| **S1-GAP-070** | ~~H2H not in production standings~~ **CLOSED S1-D** | Wrong tie order | `individualStandingsAdapter.js` | ✅ STANDINGS_V2 path in Official/Internal/BracketResults | T-S1-D03 + CC-08 #31 | — | No | Yes |
| **S1-GAP-071** | ~~Multi-team mini-table not in prod~~ **CLOSED S1-D** | 3+ tie wrong | `individualStandingsAdapter.js` | ✅ Canonical mini-table via STANDINGS_V2 | T-S1-D04 | — | No | Yes |
| **S1-GAP-072** | ~~Individual withdrawal not implemented~~ **CLOSED S1-G** | Rút lui không xử lý standings | `withdrawalEngine.js` (individual) | ✅ before/during/injury + replacement + draw exclude | T-S1-G02 | S1-GAP-076 | No | Yes |
| **S1-GAP-073** | ~~Final ranking / podium~~ **CLOSED S1-G** | Không có hạng cuối rõ | `awardsEngine.buildFinalRanking` | ✅ KO final + H3 + H4 | T-S1-G04 | S1-GAP-401 | No | Yes |
| **S1-GAP-074** | ~~Awards page mock~~ **CLOSED S1-G** | Trao giải không dùng được | `TournamentAwardsPage.jsx`, `awardsEngine.js` | ✅ Individual awards + export + close | T-S1-G04 | S1-GAP-073 | No | No |
| **S1-GAP-076** | ~~STANDINGS_V2 shadow-only~~ **CLOSED S1-D** | Legacy sort in UI | `individualStandingsAdapter.js` | ✅ Canonical-primary when flags on; legacy fallback | T-S1-D03–D05 | None | No | Yes |
| **S1-GAP-082** | Post-match legacy Elo not Rating V5 | Rating drift vs Pick_VN | `tournamentLifecycle.js` | Route finalize → Rating V5 RPC | Rating event tests | S1-GAP-083 | No | Yes |
| **S1-GAP-083** | Rating idempotency flag-gated | Duplicate rating events | `ratingIdempotencyStore.js` | Default-on for certified events | Idempotency tests | S1-GAP-082 | No | Yes |
| **S1-GAP-091** | No individual player mobile portal | VĐV không self-service | `TeamPortal.jsx` | Individual portal routes | Mobile E2E | S1-GAP-005 | No | Yes |
| **S1-GAP-092** | No public spectator page | Không trang công khai bracket | — | Public read-only route | Public smoke | S1-GAP-303,502 | No | No |
| **S1-GAP-101** | Referee polls 4s not realtime | Lag on scoreboard | `matchLiveSync.js` | TT6 pattern for individual live | Multi-device test | S1-GAP-062 | No | Yes |
| **S1-GAP-102** | No version conflict on blob save | Last-write-wins | club blob save | Optimistic version like team | Version conflict tests | S1-GAP-001 | No | Yes |

### P2 — Polish / post-pilot

| ID | Summary | Module |
|----|---------|--------|
| S1-GAP-306 | Configurable avoid-same-club-early | `drawEngine.js` |
| S1-GAP-307 | Knockout bye for non-power-of-2 | `bracketEngine.js` |
| S1-GAP-504 | Postpone UI in individual setup | `matchEngine.js` |
| S1-GAP-505 | CC-09 scheduling v2 as default | `featureFlags.js` |
| S1-GAP-065 | Retirement workflow | new |
| S1-GAP-066 | Disqualification workflow | new |
| S1-GAP-073 | Cross-event final ranking | new |
| S1-GAP-075 | Configurable tied ranks | `rankStandingsRows` |
| S1-GAP-084 | Reliability in tournament ops UI | Rating V5 |
| S1-GAP-090 | Individual mobile QA (TT9 parity) | mobile UI |
| S1-GAP-093 | Mock config load/error paths | config pages |
| S1-GAP-094 | Standings labels ("ĐỘI" → VĐV) | `BracketGroupStandingsPanel.jsx` |
| S1-GAP-103 | Offline score queue | `offlineQueue.js` |

### P3 / Document only

| ID | Summary | Status |
|----|---------|--------|
| S1-GAP-403 | Swiss — contract placeholder only | OUT OF SCOPE V5 |
| S1-GAP-404 | Double Elimination — contract placeholder only | OUT OF SCOPE V5 |

---

## Summary counts

| Priority | Count | Pilot blockers |
|----------|-------|----------------|
| P0 | 14 | 12 (10 universal + 2 singles-specific) |
| P1 | 28 | 0 direct (production/DoD) |
| P2 | 13 | 0 |
| P3 | 2 | 0 |

**Total gaps:** 57 registered items

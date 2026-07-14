# S1 — Individual Tournament: Definition of Done

**Sprint:** Tournament V5 Sprint 1  
**Target:** 100% completion from ~78% functional baseline  
**Date:** 2026-07-14

---

## DoD principles

1. **Individual only** — `internal_tournament` + `official_tournament`; team/daily/API/TV out of scope.
2. **V5 parity where team already solved it** — registration ops, publish/lock, referee propagation, standings canonical path.
3. **Rating V5** — doubles events fully wired; singles gated until Rating V5 singles ships (documented exception).
4. **No production deploy** — staging pilot ready is the sprint exit gate.
5. **No new formats** — Swiss / Double Elim remain OUT OF SCOPE unless owner expands scope.

---

## Exit criteria (sprint-level)

| # | Criterion | Measurement |
|---|-----------|-------------|
| E1 | All P0 gaps closed or explicitly waived by owner | Gap matrix = 0 open P0 |
| E2 | Registration lifecycle end-to-end on staging | Player register → approve → lock → draw |
| E3 | Draw + schedule publish/lock with regenerate guards | Cannot mutate after publish without audit |
| E4 | Referee path: assign → score → finalize → standings/bracket update | Multi-device smoke PASS |
| E5 | Standings use CC-08 canonical path for individual | H2H + mini-table in production UI |
| E6 | Rating V5: seed + post-match for doubles individual events | Idempotent rating events |
| E7 | Automated test suite green + S1 test plan executed | `npm test` + S1 manual checklist |
| E8 | Security: RLS + RBAC verified on new RPC/tables | Staging security script PASS |
| E9 | No mock/demo pages linked from production menu for S1 flows | Menu audit PASS |
| E10 | Owner sign-off on pilot dry-run | Signed checklist in `docs/v5/qa/` |

---

## Area 1 — Khởi tạo giải

| # | Requirement | DoD pass condition |
|---|-------------|-------------------|
| 1.1 | Tạo giải cá nhân (internal + official) | BTC tạo được cả hai mode; persist club blob + cloud sync stub if S1-GAP-001 shipped |
| 1.2 | Six event types selectable | All `EVENT_TYPE_*` validated at create |
| 1.3 | Multi-event trong một giải | Official: ≥2 events; Internal: ≥1 (multi optional P1) |
| 1.4 | Eligibility limits configurable | Age/gender/skill/cap rules persist on tournament; enforced at registration |
| 1.5 | Registration window | `opens`/`closes` datetime; UI blocks outside window |
| 1.6 | Entry fee config | Per-event fee config persisted |
| 1.7 | Regulations template | Regulations body persisted and shown to registrant |
| 1.8 | Status machine | draft → registration → ready (closed) → active → completed / cancelled with guards |

**DoD gate:** 1.1, 1.2, 1.4, 1.5, 1.8 mandatory; 1.3 official mandatory.

---

## Area 2 — Đăng ký

| # | Requirement | DoD pass condition |
|---|-------------|-------------------|
| 2.1 | Singles self-registration | Player submits entry; status `pending` |
| 2.2 | Doubles pair registration | Pair created with two player refs |
| 2.3 | Partner invite + confirm | Invite link/token; partner accepts before approval |
| 2.4 | BTC manual add | Retained; merges with self-service list |
| 2.5 | Approve / reject / waitlist | BTC actions change entry status; waitlist ordering |
| 2.6 | Cancel registration | Player or BTC cancels before lock |
| 2.7 | Change partner before lock | Allowed until `registrationLockedAt` |
| 2.8 | Block duplicate event + schedule conflict | Hard reject with clear message |
| 2.9 | Rating V5 eligibility at registration | Ineligible players blocked or flagged per config |
| 2.10 | Payment / fee status | `unpaid` / `paid` / `waived` on entry when fee > 0 |

**DoD gate:** 2.1–2.6, 2.8 mandatory for pilot; 2.7, 2.9, 2.10 P1 for production DoD.

---

## Area 3 — Seeding & Draw

| # | Requirement | DoD pass condition |
|---|-------------|-------------------|
| 3.1 | Rating V5 seed | Seed order uses V5 display rating when available |
| 3.2 | Manual seed override | BTC drag/edit seeds; persisted |
| 3.3 | Random draw | Open mode + engine random path tested |
| 3.4 | Balanced groups | Draw score optimization within retry budget |
| 3.5 | Avoid same club early | Config flag; soft or hard per config |
| 3.6 | Bye | RR bye + KO bye documented behavior |
| 3.7 | Lock + publish draw | `drawPublishedAt`; immutable after publish |
| 3.8 | Audit log on BTC draw edits | Actor, timestamp, before/after |
| 3.9 | Regenerate before publish | Allowed; blocked after publish |

**DoD gate:** 3.1, 3.3, 3.4, 3.7, 3.9 mandatory.

---

## Area 4 — Thể thức thi đấu

| # | Requirement | DoD pass condition |
|---|-------------|-------------------|
| 4.1 | Round Robin | Group stage fixtures generated |
| 4.2 | Group → Knockout | Qualifiers advance; bracket sync |
| 4.3 | Knockout direct | P1 — may defer if not in pilot format set |
| 4.4 | Third place | P1 — match generated when config enabled |
| 4.5 | Final | Final round always present in KO path |
| 4.6 | Swiss | OUT OF SCOPE — no DoD |
| 4.7 | Double Elimination | OUT OF SCOPE — no DoD |

**DoD gate:** 4.1, 4.2, 4.5 mandatory.

---

## Area 5 — Lịch & sân

| # | Requirement | DoD pass condition |
|---|-------------|-------------------|
| 5.1 | Generate schedule | Matches have slots after generate |
| 5.2 | Court assignment | Courts assigned without overlap |
| 5.3 | No player time conflicts | Engine rejects double-booking |
| 5.4 | Min rest | Configurable min minutes between matches per player |
| 5.5 | Change court / time | BTC or director can reschedule with audit |
| 5.6 | Postpone match | Status `postponed`; excluded from standings until resolved |
| 5.7 | Conflict handling | Warnings + blocking for hard conflicts |
| 5.8 | Lock + publish schedule | `schedulePublishedAt`; public/director read stable |

**DoD gate:** 5.1, 5.3, 5.8 mandatory; 5.4 P1.

---

## Area 6 — Trọng tài & kết quả

| # | Requirement | DoD pass condition |
|---|-------------|-------------------|
| 6.1 | Referee assignment | Server-scoped assignment row (not demo page) |
| 6.2 | Score entry | Referee V5 or classic with parity test plan |
| 6.3 | Result confirmation | Finalize → propagation job |
| 6.4 | Walkover | Recorded; standings impact correct |
| 6.5 | Retirement | P2 — document N/A if deferred |
| 6.6 | Disqualification | P2 — document N/A if deferred |
| 6.7 | Controlled correction | Request/review workflow (TT5-D pattern) |
| 6.8 | Audit log | Append-only score/result history |
| 6.9 | Propagation | Standings + bracket update exactly once |
| 6.10 | No double-count | Server idempotency key on finalize |

**DoD gate:** 6.1, 6.3, 6.4, 6.7, 6.9, 6.10 mandatory.

---

## Area 7 — Xếp hạng & tie-break

| # | Requirement | DoD pass condition |
|---|-------------|-------------------|
| 7.1 | W/L, points, diff | Displayed in standings panel |
| 7.2 | Head-to-head | 2-player tie resolved per CC-08 |
| 7.3 | Multi-team tie-break | Mini-table for 3+ ties |
| 7.4 | Forfeit / withdrawn | Correct point assignment |
| 7.5 | Final ranking | Per-event podium order |
| 7.6 | Medals / awards | P1 — preview from standings |
| 7.7 | Tied ranks | P2 — sequential rank default acceptable |

**DoD gate:** 7.1, 7.2, 7.3, 7.4 mandatory via STANDINGS_V2.

---

## Area 8 — Rating V5 integration

| # | Requirement | DoD pass condition |
|---|-------------|-------------------|
| 8.1 | Input rating at registration | Show V5 rating + reliability |
| 8.2 | Eligibility check | `isMatchRatingEligible` + registration gate |
| 8.3 | Seeding from V5 | Seed pipeline reads V5 profile |
| 8.4 | Valid match → rating event | Post-finalize RPC |
| 8.5 | Skip invalid/demo/cancelled | No rating mutation |
| 8.6 | Idempotency | Duplicate finalize → single rating delta |
| 8.7 | Reliability / confidence | Display in BTC seed UI (P2) |

**DoD gate:** 8.2, 8.3, 8.4, 8.5, 8.6 mandatory for **doubles** events.

**Singles exception:** 8.1, 8.3, 8.4 for singles blocked until Rating V5 singles — pilot may use legacy Elo with owner waiver.

---

## Area 9 — UX/UI

| # | Requirement | DoD pass condition |
|---|-------------|-------------------|
| 9.1 | BTC desktop | Full flow without console errors |
| 9.2 | BTC mobile | Critical actions ≥48px touch; bracket scroll |
| 9.3 | Player mobile | Registration + my entries view |
| 9.4 | Public page | P1 — read-only bracket/schedule after publish |
| 9.5 | Empty / loading / error | Every async view has three states |
| 9.6 | Confirmations | Destructive actions use Dialog |
| 9.7 | Bracket readability | Tree + mobile timeline usable at 375px |
| 9.8 | Standings clarity | VĐV labels (not "ĐỘI") |

**DoD gate:** 9.1, 9.2, 9.3, 9.5, 9.6, 9.7 mandatory for pilot.

---

## Area 10 — Security & reliability

| # | Requirement | DoD pass condition |
|---|-------------|-------------------|
| 10.1 | RLS on new tables/RPC | Staging verify script PASS |
| 10.2 | Cross-tenant isolation | Owner A cannot read Owner B tournament |
| 10.3 | Organizer permission | RBAC on manage actions |
| 10.4 | Referee permission | Assignment-scoped only |
| 10.5 | Player self-scope | Player edits own registration only |
| 10.6 | Correction permission | BTC/Director only for reopen |
| 10.7 | Realtime or polling | Director + referee see updates <10s |
| 10.8 | Duplicate submission | Idempotency on write RPCs |
| 10.9 | Version conflict | Optimistic lock on tournament save |
| 10.10 | Offline degraded | Document behavior; score queue P2 |

**DoD gate:** 10.1–10.6, 10.8 mandatory for pilot.

---

## Completion scoring (DoD checklist)

| Area | Items | Mandatory pass | Current est. |
|------|-------|----------------|--------------|
| 1 | 8 | 6 | 4/6 |
| 2 | 10 | 7 | 2/7 |
| 3 | 9 | 5 | 3/5 |
| 4 | 5 | 3 | 3/3 |
| 5 | 8 | 3 | 2/3 |
| 6 | 10 | 6 | 2/6 |
| 7 | 7 | 4 | 2/4 |
| 8 | 7 | 5 (doubles) | 2/5 |
| 9 | 8 | 6 | 4/6 |
| 10 | 10 | 7 | 3/7 |

**Strict DoD pass rate today: ~52%** (32/62 mandatory items)  
**Target at sprint end: 100%** (62/62, with documented singles waiver if needed)

---

## Owner waiver template

If Rating V5 singles not ready:

```text
Waiver: S1 singles events use legacy Elo for seed + post-match until V5-B singles ships.
Effective: [date] · Owner: [name] · Review by: [sprint+1]
```

---

## Sign-off

| Role | Name | Date | Verdict |
|------|------|------|---------|
| Owner | | | |
| Tech lead | | | |
| QA | | | |

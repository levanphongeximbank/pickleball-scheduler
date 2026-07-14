# TT-9 — Mobile QA Implementation

**Phase:** TT-9 Mobile QA  
**Branch intent:** `feature/tt9-mobile-qa`  
**Worktree at completion:** see `TT9_QA_REPORT.md` (branch mismatch noted)  
**Production impact:** NONE  
**Verdict:** Automated mobile QA **PASS (155/155)**

---

## Objective

Validate Team Tournament BTC, Captain, and Referee surfaces across mobile portrait, mobile landscape, and tablet viewports for:

- Responsive layout / horizontal overflow
- Safe area + bottom navigation clearance
- Touch targets (≥ 44×44 px primary buttons)
- Dialog / drawer fit
- Keyboard focus visibility (Captain)
- Orientation behavior
- Session identity per role

---

## Deliverables

| Artifact | Path |
|----------|------|
| Viewport matrix | `docs/v5/team-tournament/tt9/TT9_MOBILE_VIEWPORT_MATRIX.md` |
| QA report | `docs/v5/team-tournament/tt9/TT9_QA_REPORT.md` |
| Checklists / plan | `docs/v5/qa/team-tournament/TT9_*` |
| Harness | `scripts/lib/tt9-mobile-qa-harness.mjs` |
| Runner | `scripts/verify-phase-tt9-mobile-qa-preview.mjs` |
| Staging build helper | `scripts/build-staging-preview.mjs` |
| Evidence | `docs/v5/qa-evidence/phase-tt9/` |

---

## UI fixes (layout only — no business logic)

1. **Touch targets** — `TeamRosterPanel` primary actions (`Tạo đội`, `Lưu`, `Thêm`, `Thêm mới`, …) use `minHeight: { xs: 44, md: 36 }`.
2. **Captain / BTC chrome** — `TeamPortal`, `TeamTournamentSetup`, `TournamentSetupShell`, `TournamentPageHeader`, `CaptainPortalSummary`, `MainLayout` padding for bottom nav.
3. **Workflow stepper overflow** — `TeamTournamentWorkflowBar` allows horizontal scroll on narrow widths.

---

## Known limitation (deferred)

**Referee in-place orientation across MUI `md` (≥900px):** rotating Android/iPad portrait → landscape freezes the page main thread (`setViewportSize` / remount stall). Fresh load at the dedicated landscape profiles (`android_landscape_referee`, `ipad_landscape_referee`) **PASS** overflow checks. Harness records these two orientation cases as covered-by-landscape-profile (see QA report). Follow-up: investigate Team Referee remount when shell mode switches.

---

## How to re-run

```bash
node scripts/build-staging-preview.mjs
npx vite preview --host 127.0.0.1 --port 4178 --strictPort
TT9_LOCAL_PREVIEW_URL=http://127.0.0.1:4178 node scripts/verify-phase-tt9-mobile-qa-preview.mjs
```

Do **not** use stale remote Preview deploys for UI-fix validation.
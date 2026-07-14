# TT-9 — Mobile Viewport Matrix

**Phase:** TT-9 Mobile QA execution  
**Production impact:** NONE  
**Environment:** Staging client env via `scripts/build-staging-preview.mjs` + local `vite preview`  
**Latest harness result:** **PASS (155/155)** — see `TT9_QA_REPORT.md`

---

## Viewport matrix (automated)

| ID | Device class | Orientation | Size (px) | Mobile shell expected |
|----|--------------|-------------|-----------|------------------------|
| `iphone_portrait` | Phone | Portrait | 390 × 844 | Yes |
| `iphone_landscape` | Phone | Landscape | 844 × 390 | Yes |
| `android_portrait` | Phone | Portrait | 412 × 915 | Yes |
| `android_landscape` | Phone | Landscape | 915 × 412 | No (≥ md breakpoint) |
| `ipad_portrait` | Tablet | Portrait | 820 × 1180 | Yes |
| `ipad_landscape` | Tablet | Landscape | 1180 × 820 | No (desktop shell) |

MUI `MOBILE_BREAKPOINT` = `md` (900px). Widths ≥ 900 use desktop shell (no bottom nav).

---

## Routes under test

| Route key | Path | Role |
|-----------|------|------|
| `btc` | `/tournament/team/:tournamentId` | BTC / tournament director |
| `captain` | `/team-portal/:tournamentId` | Team captain portal |
| `referee` | `/team-referee/:tournamentId` | Team referee portal |

Probe tournament: `phase23d-probe-tournament` (staging).

---

## Layout checks (per viewport × route)

| Check | Criterion |
|-------|-----------|
| Render | Page body healthy; no 403 / empty shell |
| Horizontal overflow | `scrollWidth ≤ clientWidth + 2` |
| Bottom navigation | Visible on mobile shell viewports |
| Safe area | Bottom nav safe-area padding; main `pb ≥ 48px` |
| Scrolling | Tall pages scroll without layout break |
| Touch targets | Labeled primary buttons ≥ 44 × 44 px (IconButtons excluded) |
| Dialog (BTC) | Schedule preview/build dialog fits viewport when present |
| Keyboard (Captain) | Focused control remains visible above bottom nav |
| Orientation | Portrait → landscape: no horizontal overflow (see referee `md` note) |
| Session | Logged-in email matches expected staging account |

### Referee orientation note

In-place rotate that crosses `md` on the Team Referee portal stalls the main thread. Landscape layout is validated via dedicated landscape profiles instead of in-place remount for those two cases.

---

## Manual supplement (device lab)

Use checklists in `docs/v5/qa/team-tournament/`:

- `TT9_IPHONE_SAFARI_CHECKLIST.md`
- `TT9_ANDROID_CHROME_CHECKLIST.md`
- `TT9_DESKTOP_CHECKLIST.md`

Report template: `docs/v5/qa/team-tournament/templates/TT9_DEVICE_TEST_REPORT.json`

---

## Evidence output

| Artifact | Path |
|----------|------|
| Screenshots | `docs/v5/qa-evidence/phase-tt9/screenshots/` |
| Browser report | `docs/v5/qa-evidence/phase-tt9/TT9_MOBILE_QA_BROWSER_REPORT.json` |
| Verification report | `docs/v5/qa-evidence/phase-tt9/TT9_VERIFICATION_REPORT.json` |
| Run log | `docs/v5/qa-evidence/phase-tt9/TT9_RUN_LOG.txt` |

Automated runner: `node scripts/verify-phase-tt9-mobile-qa-preview.mjs`

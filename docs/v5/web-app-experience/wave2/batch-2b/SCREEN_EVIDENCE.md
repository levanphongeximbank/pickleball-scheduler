# Wave 2 Batch 2B — Screen / Visual Evidence

**MODE:** Foundation visual certification (no page redesign)  
**VIEWPORTS:** 1440 / 1024 / 430 (structural + token verification)

## Goal checks

| Check | Expected | Evidence |
|-------|----------|----------|
| Typography consistent (auth) | Inter stack | `TYPOGRAPHY.fontFamily`, `main.jsx` Inter load, theme typography |
| Primary action blue | `#3B82F6` | `PALETTE.primary.main`, theme `containedPrimary` |
| Success remains green | `#10B981` | `PALETTE.success.main`, `SHELL.primaryGreen` alias |
| No color semantic confusion | primary ≠ success | token lock tests |
| Shell unchanged | Figure 1 tokens/components | `figure1Tokens.js` unchanged values; no Canonical* edits |
| No layout break from gutters/breakpoints | Wave 1 bands | `BREAKPOINTS` === `FIGURE1_BREAKPOINTS` |
| Tournament 23 frozen | Experience tokens untouched | no edits under `experience-a1/visual/` |
| Public unchanged | navy + lime + DM Sans | PublicLayout font pin; PUBLIC_COLORS lime/primary green |

## Representative routes (Owner preview checklist)

Capture on Preview after deploy (or local `npm run dev` with Canonical shell flag ON):

| Route | 1440 | 1024 | 430 | Notes |
|-------|------|------|-----|-------|
| `/dashboard` | [ ] | [ ] | [ ] | Contained buttons blue; KPI success greens intact |
| `/players` | [ ] | [ ] | [ ] | Primary CTAs blue; Inter body |
| Club surface (`/manage/clubs` or My Club) | [ ] | [ ] | [ ] | Cards radius 12 |
| `/audit` | [ ] | [ ] | [ ] | Table header uses surface.muted token |
| `/tournament` hub / Experience entry | [ ] | [ ] | [ ] | Shell chrome only; Experience internals must match freeze |

## Automated evidence (this Batch)

```
TOKEN_LOCK_TESTS → tests/web-app-wave2-batch2b-foundations-tokens.test.js
FOUNDATION_A11Y_TARGETED → tests/web-app-wave2-batch2b-foundation-a11y.test.js
WAVE1_BREAKPOINT_LOCK → BREAKPOINTS mirrors FIGURE1_BREAKPOINTS
FONT_DUP_LOCK → Inter CSS once in main; figure1Fonts has zero @fontsource imports
```

Live PNG capture is deferred to Owner Preview pass if CI environment has no auth session in this worktree. Structural/token locks above are the Batch 2B gate; page screenshots do not unblock 2C once Owner accepts foundation.

```
TOURNAMENT_23_VISUAL_REGRESSION=NO  (no Experience visual file edits)
FIGURE1_SHELL_CHANGED=NO
PUBLIC_WEB_CHANGED=NO  (isolation glue only: fontFamily + primaryLight pin)
```

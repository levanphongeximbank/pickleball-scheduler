# Referee V5-C — Responsive & Accessibility Report

**Date:** 2026-07-12

---

## Responsive targets

| Viewport | Verified via |
|----------|--------------|
| 360×800 | Vitest layout tests (overflow, button spacing) |
| 390×844 | CSS mobile-first defaults |
| 430×932 | Smaller font tweak `@media (max-width: 430px)` |
| 768×1024 | `.rv5-main-grid` two-column `@media (min-width: 768px)` |
| 1366×768 | Max-width 960px workspace center |

### Mobile checks (tests 21–25)
- No horizontal overflow on 360px width
- `ĐANG GIAO` / `ĐỠ BÓNG` text visible (not color-only)
- Rally buttons side-by-side without overlap
- Serve arrow visible above player cards (`z-index` layering)
- Timeline scroll contained; action panel remains visible

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Button accessible names | `aria-label` on all action buttons |
| Server/receiver text labels | Badges + serve context panel |
| Arrow text equivalent | SVG `aria-label` + serve context direction |
| Keyboard focus | Native `<button>` elements |
| Contrast | Dark scoreboard on blue; badges with text |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` |
| Screen reader score | `aria-label` on scoreboard teams |

---

## Known prototype limits

- No live screen reader device QA (automated tests only)
- Outdoor glare/contrast not field-tested
- Tablet landscape polish minimal beyond 768px grid

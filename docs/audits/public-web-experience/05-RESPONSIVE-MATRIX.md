# 05 — Responsive Matrix

**Audit date:** 2026-08-22  
**Important:** `CODE_INSPECTION != RENDERED_VISUAL_VERIFICATION`

### Rendered verification status

```text
node_modules present = NO
dependency install for audit = FORBIDDEN
dev server run = NOT PERFORMED
RENDERED_VISUAL_VERIFICATION = NOT_TESTED (all viewports)
```

All cells below are **NOT_TESTED** for rendered PASS/FAIL. Code-inferred notes are informational only and must not be treated as PASS.

---

## Target viewports

`1920 | 1440 | 1024 | 768 | 430 | 390 | 360`

---

## Page × viewport matrix

| Page / Surface | 1920 | 1440 | 1024 | 768 | 430 | 390 | 360 |
|----------------|------|------|------|-----|-----|-----|-----|
| Homepage | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Tournament Discovery | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Canonical Public Tournament #23 | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Club Discovery | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Club Detail (404 stub) | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Courts Discovery | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Court Detail (404 stub) | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Rankings | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| News | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Login / Signup mode | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Public Header / Drawer | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Public Footer | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED |

---

## Code-inferred risk notes (not PASS)

| Area | Evidence | Risk |
|------|----------|------|
| Nav gap `md`–`lg` | Desktop nav `lg:flex`; hamburger `md:none` | Tablet may show hamburger + dense CTA |
| Login CTA | Ghost “Đăng nhập” hidden `xs` | Mobile depends on lime CTA only |
| Hero art | Side art `md:flex` / `xs:none` | Simplified mobile — OK if intentional |
| Rankings table | MUI Table on dark card | Likely horizontal scroll on 360 — verify later |
| Tournament #23 tabs | Many tab labels in Vietnamese | Overflow/scroll risk on 360 |
| Long labels | “Đăng ký miễn phí”, status chips | Tap/wrapping risk |
| Footer grid | `xs:12` / `md` columns | Likely stacks — verify |
| `overflowX: hidden` on #23 root | Present | May mask overflow bugs |

---

## Recommended verification in Wave 9 (after Owner GO)

1. Install deps in implementation wave (not audit).  
2. Run Vite preview.  
3. Capture screenshots at all seven widths for each major public surface.  
4. Owner screenshot review before merge.  
5. Only then set PASS / PARTIAL / FAIL.

---

## Machine fields for master report

```text
RESPONSIVE_1920=NOT_TESTED
RESPONSIVE_1440=NOT_TESTED
RESPONSIVE_1024=NOT_TESTED
RESPONSIVE_768=NOT_TESTED
RESPONSIVE_430=NOT_TESTED
RESPONSIVE_390=NOT_TESTED
RESPONSIVE_360=NOT_TESTED
```

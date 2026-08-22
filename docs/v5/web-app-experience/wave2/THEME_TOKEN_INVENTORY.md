# THEME / TOKEN INVENTORY — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY  
**REUSE_BEFORE_REBUILD=YES**

```
THEME_IMPLEMENTATION_COUNT=6
ACTIVE_THEME_IMPLEMENTATION_COUNT=5
TOKEN_SYSTEM_COUNT=15
ACTIVE_TOKEN_SYSTEM_COUNT=13
HARDCODED_COLOR_PATTERN_COUNT=43
HARDCODED_COLOR_DISTINCT_HEX=216
HARDCODED_COLOR_LITERALS=787
HARDCODED_SPACING_PATTERN_COUNT=359
CANONICAL_THEME_CANDIDATE=src/theme/theme.js
CANONICAL_TOKEN_CANDIDATE=src/theme/designTokens.js
```

---

## 1. Theme implementations

| FILE | EXPORT | USED_BY | SCOPE | ACTIVE_OR_LEGACY | DUPLICATES | CLASSIFICATION |
|------|--------|---------|-------|------------------|------------|----------------|
| `src/theme/theme.js` | default `createTheme` | `src/main.jsx` `<ThemeProvider>` | All routes | **ACTIVE** | Hardcodes table greys `#F8FAFC` / `#FAFBFC`, toggle `#D1FAE5` instead of tokens | **KEEP_CANONICAL** / AUTH_GLOBAL_MUI |
| `src/features/canonical-shell/theme/figure1ShellTheme.js` | `createFigure1ShellTheme(baseTheme)` | `CanonicalAppShell.jsx` nested `ThemeProvider` | Shell subtree when flag ON | **ACTIVE** | Overrides `fontFamily` (Inter) + `MuiCard` radius 12 | **FROZEN** SHELL_NESTED_THEME — do not add another nested theme |
| `src/components/tournament/animation/shared/tournamentAnimationTheme.css` | `--tournament-*` | Animation screens | Tournament presentation | **ACTIVE** | Mixes Slate green with Material `#0d47a1` / `#64b5f6` | **TOURNAMENT_SHARED** |
| `src/components/tournament/bracket/tournamentBracket.css` | `--bracket-*` | Bracket UI | Tournament bracket | **ACTIVE** | Green family | **TOURNAMENT_SHARED** |
| `src/components/tournament/team/teamStandings.css` | `--team-standings-*` | Team standings | Team tournament | **ACTIVE** | Purple `#7c3aed` | **TOURNAMENT_SPECIFIC** |
| `src/index.css` | Vite `--accent: #aa3bff` | **Not imported** | Dead scaffold | **LEGACY** | Unrelated purple | **DEPRECATE_AFTER_ADOPTION** (delete only when proven unused) |

`ThemeProvider` call sites: **2** (`main.jsx` global, `CanonicalAppShell` nested). Wave 2 must not create a third.

---

## 2. Token systems

| FILE | EXPORT | USED_BY | SCOPE | ACTIVE_OR_LEGACY | DUPLICATES | CLASSIFICATION |
|------|--------|---------|-------|------------------|------------|----------------|
| `src/theme/designTokens.js` | `PALETTE`, `SHELL`, `LAYOUT`, `TYPOGRAPHY`, `SHAPE`, `DESIGN_DIRECTION` | `theme.js`, public (partial), calendar, KPIs, `shellTokens` | Authenticated Slate Enterprise | **ACTIVE** | Neutrals overlap Figure 1 / Experience | **KEEP_CANONICAL** AUTH_TOKENS |
| `src/theme/figure1Tokens.js` | `FIGURE1_*`, `FIGURE1_CSS_VARS`, breakpoints 899/900/1199/1200 | Canonical shell; `theme.canonicalNav` / `theme.figure1` | Shell / nav | **ACTIVE** | Sidebar navy `#0F1B2D` vs Slate `#0F172A`; accent `#3B82F6` vs `#10B981` | **FROZEN** SHELL_TOKENS |
| `src/components/shell/shellTokens.js` | `SHELL_COLORS`, `SHELL_LAYOUT` | Legacy `MainLayout`, Login, Roles, some KPIs | Compat re-export of designTokens | **ACTIVE compat** | None (re-export) | **KEEP** until legacy shell retired |
| `src/components/shell/sidebarNavTokens.js` | `SIDEBAR_NAV`, `sidebarNavItemSx` | Legacy sidebar | Legacy chrome | **ACTIVE (legacy path)** | Hardcodes `#10B981`; `minHeight: 34` | **FEATURE_SPECIFIC_KEEP** / legacy; a11y debt |
| `src/components/public/publicPortalStyles.js` | `PUBLIC_COLORS`, section/card/CTA sx | Public layout + pages | Public portal | **ACTIVE** | Lime `#C5E831` ≠ `SHELL.accentLime` `#84CC16` | **PUBLIC_SHARED** |
| `src/features/tournament/experience-a1/visual/tournamentExperienceTokens.js` | `TOURNAMENT_COLOR`, space/radius/type, `primaryActionSx` | Experience-a1 ~23 screens | Frozen tournament UX | **ACTIVE** | Primary `#2563EB` vs Figure 1 `#3B82F6` vs Slate green | **FROZEN** TOURNAMENT_SPECIFIC |
| `src/pages/courtManagement/calendar/courtCalendarTokens.js` | `CALENDAR_*`, `PAYMENT_PILL_COLORS` | Court calendar | Court ops | **ACTIVE** | Status greens parallel Slate | **DOMAIN_SPECIFIC** |
| `src/features/club/ui/clubUiTokens.js` | maxWidth, padding, card sx | Club UI | Club module | **ACTIVE** | Spacing only; uses theme `divider` | **DOMAIN_SPECIFIC** (good spacing citizen) |
| `src/features/dashboard-analytics/constants/dashboardLayout.js` | `DASHBOARD_LAYOUT`, card sx | Dashboard analytics | Dashboard | **ACTIVE** | Shadow duplicates `SHELL.cardShadow` | **DOMAIN_SPECIFIC** |
| `src/features/team-tournament/showcase/showcaseStyles.js` | `showcase*Sx` | Team showcase | Projector | **ACTIVE** | Dark + neon `#7CFFB2`; Plus Jakarta declared, **not loaded** | **FROZEN_VISUAL** |
| `src/features/referee-v5/styles/refereeV5.css` | class palette | Referee V5 | Referee | **ACTIVE** | Parallel hex system | **FROZEN_VISUAL** / DOMAIN |
| Animation / bracket / standings CSS | CSS vars | See §1 | Tournament | **ACTIVE** | Counted as both theme + token surfaces | **TOURNAMENT_*** |
| `src/index.css` | scaffold vars | unused | Dead | **LEGACY** | Purple | **DEPRECATE_AFTER_ADOPTION** |

`TOKEN_SYSTEM_COUNT=15` includes re-export + dead + three CSS var sheets.  
`ACTIVE_TOKEN_SYSTEM_COUNT=13` excludes dead `index.css` and does not double-count `shellTokens` as independent palette (**13** = 12 named live + CSS sheets treated as live token surfaces; `shellTokens` counted in the 15, excluded from independent 13).

Independent **live** palettes that matter for Wave 2 decisions: **Slate**, **Figure 1**, **Public lime**, **Experience blue**, plus domain islands (calendar, referee, showcase, animation).

---

## 3. Breakpoints / z-index / radius / elevation

### Breakpoints — FROZEN (Wave 1)

| Token | Value | Consumer |
|-------|-------|----------|
| `FIGURE1_BREAKPOINTS.mobileMax` | 899 | Canonical shell layout |
| `tabletMin` / `tabletMax` | 900 / 1199 | Canonical shell |
| `desktopMin` | 1200 | Canonical shell |
| `useIsMobile` | MUI `down("md")` = `<900` | `ResponsiveDataView`, mobile feature |

Alignment: mobile cutoff **matches** Wave 1. Tablet vs desktop **content** often uses MUI `sm`/`md`/`lg` (600/900/1200) inconsistently. Do **not** change shell breakpoints. 2B may document a content gutter recipe only.

### Layout gutters

| Source | Desktop | Mobile |
|--------|---------|--------|
| `LAYOUT.contentPadding` | 24 | (none) |
| `FIGURE1_LAYOUT` | 24 | 16 |
| Legacy `MainLayout` | `md: 24px` | `xs: 1.5` (12px) |
| Club | `{ xs: 2, md: 3 }` → 16 / 24 | |
| Public | `{ xs: 2, sm: 3, md: 4 }` | |

**CANONICAL_PAGE_GUTTER_CANDIDATE:** **24px desktop / 16px mobile** (already Figure 1 + Slate 24). Align leftover `xs: 1.5` toward 16 when a page is touched — not a shell change.

### Radius

| Source | Control | Card |
|--------|---------|------|
| `SHAPE` | 10 | 16 (`borderRadiusLg`) |
| Figure 1 | — | 12 (`MuiCard` override in shell theme) |
| Experience | 10 | 12; pill 999 |
| Club cards | MUI `borderRadius: 2` (8px) | |

Inconsistency: **8 / 10 / 12 / 16**. 2B should pick workspace card radius **12** to match Figure 1 shell + Experience cards, via **adapting** `theme.js` `MuiCard` — Owner confirm. Shell already 12 when Canonical ON.

### Elevation / z-index

- Slate: `headerShadow` / `cardShadow` `0 1px 3px rgba(15,23,42,0.06)`
- Figure 1: same family `rgba(15,27,45,0.08)`; topbar `none` + 1px border
- `FIGURE1_LAYOUT.zIndexSidebar=1200`
- Presentation overlays 1400–1500 (showcase/anim) — **FROZEN**, do not flatten into auth z-scale in 2A

---

## 4. Color semantics

### Roles present in Slate `PALETTE` / `SHELL`

| Role | Token? | Value |
|------|--------|-------|
| background | yes | `#F8FAFC` |
| surface (paper) | yes | `#FFFFFF` |
| surface-elevated | **gap** | only via shadows |
| border / divider | yes | `#E2E8F0` |
| text-primary | yes | `#0F172A` |
| text-secondary | yes | `#64748B` |
| primary | yes | `#10B981` |
| secondary | yes | `#64748B` |
| success | yes | `#10B981` (same as primary) |
| warning | yes | `#D97706` |
| error | yes | `#DC2626` |
| info | **gap** | Experience uses primary blue surface |
| disabled | partial | Experience `#94A3B8`; MUI default |
| focus | Figure 1 only | `#3B82F6` shell |
| selected / hover | partial | `SHELL.accentLight` `#ECFDF5`; table hover |

### SEMANTIC_COLOR_COVERAGE

Covered for auth workspace: background, surface, border, text, primary, secondary, success, warning, error, sidebar (legacy).  
Scoped (must stay scoped): Figure 1 nav blue, Public lime, Experience blue, calendar payment pills, showcase neon.

### HARDCODED_COLOR_HOTSPOTS

Measured under `src/` (js/jsx/css): **787** hex literals, **216** distinct, **43** patterns with ≥5 hits, **121** files.

Highest-density files (acceptable if frozen/scoped):

1. `dailyFairMatch.css` (72) — TOURNAMENT / FROZEN_VISUAL  
2. `tournamentAnimationTheme.css` (63)  
3. `courtCalendarTokens.js` (35) — DOMAIN  
4. `publicPortalStyles.js` (33) — PUBLIC  
5. `refereeV5.css` (33) — DOMAIN / FROZEN  
6. `tournamentBracket.css` (32)  
7. `tournamentExperienceTokens.js` (30) — FROZEN  
8. `TeamAiPairingDialog.jsx` (25) — FROZEN_VISUAL / ops  
9. `designTokens.js` (26) — canonical (expected)  
10. `figure1Tokens.js` (19) — canonical shell (expected)

Top literals: `#FFF`/`#FFFFFF`, `#E2E8F0`, `#F8FAFC`, `#64748B`, `#10B981`, Material `#1565C0`/`#2E7D32`, showcase `#7CFFB2`/`#07111F`.

### COLOR_SEMANTIC_GAPS

1. No shared `info`, `live`, `neutral-surface`, `surface-elevated`, `focus-ring` on the **workspace** token object.  
2. `success.main === primary.main` (`#10B981`) — semantic collision.  
3. Two limes (`#84CC16` vs `#C5E831`) — keep public lime scoped.  
4. Three “primaries” in production: Slate green (body), Figure 1 blue (shell), Experience blue (frozen module).  
5. Dead purple Vite tokens would be catastrophic if `index.css` were ever imported.

**Do not** force Tournament Blue or Public Lime to become global without Owner GO. 2B default recommendation: **keep Slate green as workspace primary**, keep Figure 1 blue **shell-only**, unless Owner chooses alignment to Figure 1 blue for buttons in the workspace.

---

## 5. Typography

| Scale | Source | Font | Notes |
|-------|--------|------|-------|
| MUI default | `theme.js` | DM Sans | Only boldens h4–h6; button `textTransform: none` |
| Figure 1 | `FIGURE1_TYPOGRAPHY` | Inter | group 11/600, item 14/500, title 16/600, pageHeading **24/700** |
| Experience | `TOURNAMENT_TYPE` | inherits | 11–28px, weights 600–800 |
| Public display | public pages | inherits DM Sans | h3/800, often uppercase |
| Showcase | `showcaseStyles` | Plus Jakarta **declared, not loaded** | 2rem–9rem projector |

```
TYPOGRAPHY_SCALE_COUNT=5
CANONICAL_TYPOGRAPHY_CANDIDATE=DM Sans via designTokens for workspace; Inter FROZEN for Canonical shell
TYPOGRAPHY_INCONSISTENCY_COUNT=6
```

Inconsistencies:

1. Dual stack Inter (shell) vs DM Sans (body) when Canonical ON.  
2. Plus Jakarta in `package.json` / showcase — never imported in `main.jsx`.  
3. `fontWeight: 900` in many files vs token max 800.  
4. Ad-hoc `fontSize` vs MUI variants (page titles h4 vs h5 vs 22px Experience).  
5. Public uppercase display vs auth sentence case.  
6. Players page uses `TournamentPageHeader` type, not an auth scale.

Fonts loaded: `@fontsource/dm-sans` in `main.jsx`; Inter dynamic import only when Canonical shell mounts.

English/Vietnamese: `canonicalVietnameseLabels.js` brand tokens (PICK_VN, AI, VPR, …) approved untranslated. Truncation: W6-PAGE-002 ellipsis on audit metadata — no shared truncate primitive.

---

## 6. Spacing primitives

**COMMON_SPACING_VALUES** (MUI spacing units, 8px grid — prior repo-wide scan):

| Pattern | Approx hits |
|---------|------------:|
| `mb: 2` | ~614 |
| `mb: 1` | ~336 |
| `mt: 1` | ~179 |
| `p: 2` | ~172 |
| `mb: 1.5` | ~155 |
| `p: 1.5` / `p: 1` / `p: 3` | ~78 / 64 / 58 |

**ARBITRARY_SPACING_HOTSPOTS:** Experience headers `1.75`/`2.25`; showcase `1.2`/`1.6`; dashboard `gridSpacing: 2.5` vs `LAYOUT.dashboardGridSpacing: 20`; anim CSS 6/12/16/20 mixed with radius 14–20.

2B should extend `LAYOUT` with `contentPaddingMobile: 16`, `cardPadding`, `sectionGap` — **adapt object**, do not create `tokens-v2.js`.

# DESIGN SYSTEM OWNERSHIP MATRIX — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY  
Every candidate shared component has **one** owner classification. Domain components must not silently become global SSoT.

Allowed owners:

- `GLOBAL_FOUNDATION`
- `GLOBAL_PRIMITIVE`
- `AUTHENTICATED_SHARED`
- `PUBLIC_SHARED`
- `TOURNAMENT_SHARED`
- `DOMAIN_SPECIFIC`
- `FROZEN`

---

## Layer 0 — Foundations

| Asset | Classification | Notes |
|-------|----------------|-------|
| `src/theme/designTokens.js` | GLOBAL_FOUNDATION | Workspace SSoT to **adapt** |
| `src/theme/theme.js` | GLOBAL_FOUNDATION | Single root ThemeProvider |
| `src/theme/figure1Tokens.js` | FROZEN | Shell overlay; Wave 1 |
| `figure1ShellTheme.js` nested ThemeProvider | FROZEN | Do not add a third provider |
| Wave 1 breakpoints 899/900/1199/1200 | FROZEN | |
| `shellTokens.js` | GLOBAL_FOUNDATION | Compat re-export |
| `sidebarNavTokens.js` | DOMAIN_SPECIFIC | Legacy shell path |
| `publicPortalStyles.js` | PUBLIC_SHARED | |
| `tournamentExperienceTokens.js` | FROZEN | Isolated |
| `courtCalendarTokens.js` | DOMAIN_SPECIFIC | |
| `clubUiTokens.js` | DOMAIN_SPECIFIC | |
| `dashboardLayout.js` | DOMAIN_SPECIFIC | |
| `showcaseStyles.js` | FROZEN | |
| referee / anim / bracket CSS | FROZEN or TOURNAMENT_SHARED | Do not globalize |
| `src/index.css` | DOMAIN_SPECIFIC / dead | Deprecate after proof unused |

---

## Layer 1 — Primitives

| Asset | Classification |
|-------|----------------|
| MUI Button / IconButton / TextField / Select / Chip / Card / Paper / Table / Dialog / Alert / Tabs | GLOBAL_PRIMITIVE (via theme.js) |
| StatusToneChip (proposed 2C) | AUTHENTICATED_SHARED |
| ExperienceStatusChip | FROZEN |
| Public CTA sx | PUBLIC_SHARED |
| `@mui/icons-material` | GLOBAL_PRIMITIVE |
| UserAvatar | GLOBAL_PRIMITIVE (truly global reuse) |

---

## Layer 2 — Shared patterns

| Asset | Classification |
|-------|----------------|
| CanonicalTopBar / Sidebar / Drawer / BottomNav | FROZEN (Wave 1 AUTH chrome) |
| AuthPageHeader (proposed from ClubPageShell) | AUTHENTICATED_SHARED |
| ClubPageShell (today) | DOMAIN_SPECIFIC until 2D extracts header |
| ExperiencePageHeader | FROZEN |
| TournamentPageHeader | TOURNAMENT_SHARED — stop using on Players |
| AuthEmpty / Loading / Error (proposed) | AUTHENTICATED_SHARED |
| ClubEmptyState / TournamentUiState (today) | DOMAIN_SPECIFIC / TOURNAMENT_SHARED |
| PublicPresentationStates | PUBLIC_SHARED |
| AuthConfirmDialog (proposed from ClubConfirmDialog) | AUTHENTICATED_SHARED |
| ClubConfirmDialog (today) | DOMAIN_SPECIFIC until extract |
| ResponsiveDataView | AUTHENTICATED_SHARED (currently filed under mobile) |
| InterventionFeedbackSnackbar | AUTHENTICATED_SHARED |
| ForbiddenPage | AUTHENTICATED_SHARED |
| FilterBar (proposed) | AUTHENTICATED_SHARED |
| CanonicalGlobalSearch | FROZEN (shell) |
| GlobalSearch | DOMAIN_SPECIFIC / legacy |

---

## Layer 3 — Domain composition

| Asset | Classification |
|-------|----------------|
| ClubCard, ClubStatusBadge, GovernanceRoleChip | DOMAIN_SPECIFIC |
| PlayerCard, CourtCard | DOMAIN_SPECIFIC |
| KpiCard | DOMAIN_SPECIFIC (metric recipe may be AUTHENTICATED_SHARED in 2D if extracted) |
| Tournament list/standings/match cards | TOURNAMENT_SHARED |
| Finance / CRM / Billing state views | DOMAIN_SPECIFIC |
| Calendar tokens / boards | DOMAIN_SPECIFIC |
| Rating / VPR badges | DOMAIN_SPECIFIC |
| Public catalog cards | PUBLIC_SHARED |

---

## Layer 4 — Pages

Page files remain page-owned. They **consume** Layers 0–2; they do not own tokens.

Tournament Experience 23 pages: **FROZEN**.  
Public homepage and catalog pages: **PUBLIC_SHARED** workstream, not Wave 2 restyle.

---

## Rule

If a component encodes **domain status enums**, **competition rules**, or **marketing lime/navy**, it is not GLOBAL_FOUNDATION. Only **tone** (success/warning/danger/neutral) may be AUTHENTICATED_SHARED.

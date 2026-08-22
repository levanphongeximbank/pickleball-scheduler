# CARD / SURFACE MATRIX — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY

```
CARD_PATTERN_COUNT=11
DUPLICATE_CARD_PATTERN_COUNT=4
CANONICAL_SURFACE_CANDIDATE=MUI Card / Paper via src/theme/theme.js
```

Named `*Card*.jsx` files: **38**. Patterns below are **visual roles**, not file count.

---

## 1. Pattern families

| Pattern | Type | Representative files | Scope | ACTION |
|---------|------|----------------------|-------|--------|
| MUI Card (theme) | CONTENT_SURFACE | `theme.js` MuiCard: radiusLg 16, divider border, `SHELL.cardShadow` | AUTH_GLOBAL | **KEEP_CANONICAL** — shell nested theme sets radius **12** on Card when Canonical ON |
| MUI Paper outlined | CONTENT_SURFACE | Admin/finance tables, club registry paper | AUTH | KEEP |
| Dashboard KPI | METRIC | `KpiCard.jsx`; local `StatCard` in `Dashboard.jsx` | AUTH / DOMAIN | **ADAPT** KpiCard; **CONSOLIDATE_LATER** StatCard duplicate |
| Experience KPI | METRIC | `CenterKpiCard`, `TournamentKpiCard` | FROZEN | **FROZEN** |
| Domain entity | CONTENT_SURFACE | `PlayerCard`, `courts/CourtCard`, `club/ui/ClubCard` | DOMAIN | **FEATURE_SPECIFIC_KEEP** |
| Public catalog | FEATURE_SPECIFIC | `public/cards/{Club,Court,Tournament}Card`, `EcosystemCard` | PUBLIC_SHARED | PUBLIC — do not merge with auth cards |
| Feature / mode entry | ACTION_CARD | `ModeCard`, dashboard hub cards, reports hub | AUTH / TOURNAMENT | FEATURE_SPECIFIC_KEEP |
| Tournament match/section | CONTENT_SURFACE / STATUS_CARD | `MatchCard`, `TournamentSectionCard`, bracket cards | TOURNAMENT_SHARED | FEATURE_SPECIFIC_KEEP |
| Experience operator/mobile/pair | CONTENT_SURFACE | `ExperienceOperatorCard`, `ExperienceMobileRecordCard`, `ExperienceFormationPairCard`, `CenterRightRailCard` | FROZEN_VISUAL | **FROZEN** |
| Animation / draw | FEATURE_SPECIFIC | DrawReveal, DailyMatch, Participant/Team animation cards | FROZEN_VISUAL | **FROZEN** |
| Promo / shell | ACTION_CARD | `SidebarSubscriptionCard` | AUTH chrome | FEATURE_SPECIFIC_KEEP |

**DUPLICATE_CARD_PATTERN_COUNT=4:** KPI (4 implementations), entity list cards (auth vs public twins), match cards (ops vs animation), bordered Paper vs Card for the same “section”.

---

## 2. Canonical surface

**KEEP** MUI `Card` + `Paper` as the authenticated surface. Figure 1 already specifies card radius 12, padding 20, gap 16, hover elevation.

2B/2C should **adapt** `theme.js` so workspace Card radius matches Figure 1 **12** (today theme uses `SHAPE.borderRadiusLg=16`, then shell overrides to 12). That override leak is why nested ThemeProvider exists — 2B may fold radius 12 into **base** theme so pages outside shell subtree still match. Owner confirm. Do not restyle Public glass cards.

---

## 3. Adoption (later)

| Field | Value |
|-------|-------|
| NEW_CANONICAL | None — MUI Card/Paper |
| EXISTING_COMPONENT_TO_ADAPT | `theme.js` MuiCard/MuiPaper; `KpiCard` as metric recipe |
| LEGACY_COMPONENTS | Dashboard local StatCard; 38 named cards stay |
| ADOPTION_APPROACH | Token radius/shadow first; pilots use Card not custom boxes |
| DELETE_WHEN | StatCard after Dashboard uses KpiCard |
| ROLLBACK | Revert theme Card overrides |

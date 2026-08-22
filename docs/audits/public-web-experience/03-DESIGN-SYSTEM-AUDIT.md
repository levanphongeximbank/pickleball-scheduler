# 03 — Design System Audit (Public Web)

**Audit date:** 2026-08-22  
**Method:** Code inspection only.

---

## Two parallel systems

### A. Public portal (marketing)

**File:** `src/components/public/publicPortalStyles.js`

| Token | Value / pattern |
|-------|-----------------|
| Background | `#0B0F19` / `#080C14` deep navy |
| Surface | `#1A2030` |
| Lime CTA | `#C5E831` / `#A8C929` |
| Also primary emerald | `#10B981` (mixed) |
| Text | `#FFFFFF` / muted rgba |
| Container max | 1280 |
| Cards | `publicCardSx`, `glassCardSx` |
| Buttons | `publicCtaButtonSx`, outline, ghost |
| Hero | Gradient navy + lime/emerald radials |
| Motion | `heroEntranceSx` + `prefers-reduced-motion` |

Typography: MUI + DM Sans (app-wide from `main.jsx`); public uses heavy uppercase display helpers (`displayHeadingSx`).

### B. Authenticated app theme

**Files:** `src/theme/designTokens.js`, `src/theme/theme.js`

| Token | Value |
|-------|-------|
| Primary | `#10B981` emerald |
| Shell navy | `#0F172A` |
| Accent lime | `#84CC16` (≠ public `#C5E831`) |
| Page bg | `#F8FAFC` light |

### C. Tournament Experience tokens

**File:** `tournamentExperienceTokens.js` — used by `#23` public tournament page (navy/primary tournament language), **not** `PUBLIC_COLORS`.

### D. Login / auth pages

Uses `SHELL_COLORS` / product branding **Pickleball Scheduler Pro** — outside PublicLayout. Weak visual relationship to public portal.

---

## Shared vs duplicated vs page-local vs conflicts

| Category | What |
|----------|------|
| **WHAT_IS_SHARED** | MUI components; DM Sans; some palette imports from designTokens into public styles; identity `UserAvatar` in header when authed |
| **WHAT_IS_DUPLICATED** | Navy + green language three ways (public lime, shell lime, tournament navy); multiple “PICK_VN” vs “PB Scheduler” brand strings |
| **WHAT_IS_PAGE_LOCAL** | Home sections (`HeroSection`, `LiveDataHubSection`, `StatsSection`); News cards; Rankings table; Tournament #23 tabs/layout |
| **WHAT_CONFLICTS** | Public lime `#C5E831` vs shell `#84CC16` vs emerald primary; HTML title brand vs chrome brand; login outside public shell |

---

## Component inventory (public)

| Element | Location | Notes |
|---------|----------|-------|
| Header | `PublicHeader.jsx` | Sticky; transparent on home |
| Footer | `PublicFooter.jsx` | Columns + newsletter field |
| Mobile nav | Drawer &lt; `md` | Desktop nav only ≥ `lg` |
| Cards | `TournamentCard`, `ClubCard`, `CourtCard` | |
| States | Loading / Empty / Error / Unavailable / DataSourceNotice | Strong honesty pattern |
| Tables | RankingsPage | Light-on-dark card table |
| Tabs | Tournament #23 only | |
| Inputs | Search fields on tournaments/rankings | |
| Badges/Chips | Status chips via `statusChipColors` | |
| Skeleton | Loading states (not full skeleton system) | |

---

## Convergence recommendation (do not implement yet)

1. Treat **publicPortalStyles** as canonical for **pre-login** surfaces.  
2. Align login/register **branding** toward PICK_VN + public tokens without changing auth authority.  
3. Keep tournament #23 tokens for Experience continuity; optionally share header brand strip only.  
4. Do **not** force authenticated Slate light theme onto public marketing.  
5. Unify lime accent to one public CTA value; document mapping to app shell separately.  
6. Replace non-functional social chips with real links or remove.

**Decision default:** CONVERGE public shell first; CONVERGE auth entry visuals later (Wave 8).

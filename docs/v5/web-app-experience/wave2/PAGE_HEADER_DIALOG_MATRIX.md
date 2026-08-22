# PAGE HEADER / DIALOG MATRIX — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY

Do **not** confuse `CanonicalTopBar` (Wave 1 global chrome) with page-level headers.  
Do **not** modify frozen `ExperiencePageHeader`.

```
PAGE_HEADER_IMPLEMENTATION_COUNT=8
CANONICAL_PAGE_HEADER_CANDIDATE=ClubPageShell (adapt API) — learn density from ExperiencePageHeader
PAGE_HEADER_DUPLICATION_COUNT=7
DIALOG_IMPLEMENTATION_COUNT=23
CONFIRM_PATTERN_COUNT=14
CANONICAL_DIALOG_CANDIDATE=ClubConfirmDialog
```

---

## 1. TopBar vs PageHeader

| Piece | File | Role | Wave |
|-------|------|------|------|
| CanonicalTopBar | `canonical-shell/components/CanonicalTopBar.jsx` | Sticky AppBar: breadcrumbs, search, tenant/club, notifications, account | **Wave 1 FROZEN** |
| CanonicalBreadcrumbs | `CanonicalBreadcrumbs.jsx` | Trail **inside TopBar** | FROZEN |
| Page header | below TopBar | Title, subtitle, primary/secondary actions, status, in-page tabs | **Wave 2** |

---

## 2. Page header implementations (8)

| # | Implementation | File | Has title | Subtitle | Crumbs | Actions | Status | Tabs | ACTION |
|---|----------------|------|-----------|----------|--------|---------|--------|------|--------|
| 1 | ExperiencePageHeader | `experience-a1/visual/ExperiencePageHeader.jsx` | h1 18/22 | yes | no (shell has) | yes, wrap on mobile | via children | no | **FROZEN** |
| 2 | CenterPageHeader | `CenterPageHeader.jsx` | yes | yes | no | yes | yes | no | **FROZEN** |
| 3 | TournamentPageHeader | `components/tournament/TournamentPageHeader.jsx` | yes | yes | no | yes | no | no | CONSOLIDATE_LATER — **leaked into `Players.jsx`** |
| 4 | ClubPageShell | `features/club/ui/ClubPageShell.jsx` | h1 h5/700 | yes | yes (in-page) | yes | no | no | **ADAPT_CANONICAL** |
| 5 | DirectorHeader | director | composite | yes | no | yes | access denied | no | FEATURE_SPECIFIC_KEEP |
| 6 | PublicSectionHeader | public | yes | yes | no | no | no | no | PUBLIC_SHARED |
| 7 | BracketHeader | bracket | domain | — | — | — | — | — | TOURNAMENT_SPECIFIC |
| 8 | Ad-hoc Typography | Audit, Finance, CRM, Admin, Support, Dashboard | h4/h5 mix | sometimes | rare | Stack of Buttons | Chip on some | CourtManagement Tabs | CONSOLIDATE_LATER |

`PAGE_HEADER_DUPLICATION_COUNT=7` named families plus the ad-hoc pattern (#8).

**Canonical candidate:** generalize `ClubPageShell` **header slice** (title, subtitle, breadcrumbs, actions, responsive stack) as authenticated PageHeader. Optional `maxWidth` stays club-specific. Copy Experience mobile action wrap **without** importing tournament tokens. Court **Tabs** stay a layout primitive (`CourtManagementLayout`), not inside PageHeader.

---

## 3. Dialogs (`*Dialog*.jsx` = 23)

Confirm-style:

- `ClubConfirmDialog.jsx` — **canonical candidate** (title, body, Huỷ / Xác nhận, loading, `confirmColor`, disable close while loading, autoFocus confirm)
- `RefereeConfirmationDialog.jsx`
- `ClubDeactivateDialog.jsx`
- `TeamWithdrawTeamDialog.jsx`
- `TeamForfeitDialog.jsx`

Form / ops (FEATURE_SPECIFIC_KEEP): ClubForm, MemberForm, CustomerForm, CustomerDetail, JoinClub, AssignClubOwner, BuildSchedule, TeamAiPairing, TeamLineupOverride, TeamSchedulePreview, RefereeAssign, RefereeQr, MatchAuditHistory, TournamentAnimation, TournamentPlayerQuickAdd, BroadcastSetup, CourtQuickManage, FacilityClaim.

Drawers used as **navigation** (not dialogs): CanonicalMobileDrawer, MobileDrawer, PublicHeader Drawer — **FROZEN / PUBLIC**. Do not treat as form dialogs.

---

## 4. Confirm patterns (`CONFIRM_PATTERN_COUNT=14`)

5 named confirm dialogs above + ~9 `window.confirm` sites (setups, coaching, user management, pairing admin, PWA reload, my-club schedule).

| Dialog concern | ClubConfirmDialog | Typical MUI Dialog | window.confirm |
|----------------|-------------------|--------------------|----------------|
| Title / body / actions | yes | varies | browser |
| Cancel | Huỷ | often | OK/Cancel native |
| Destructive | `confirmColor="error"` | ad-hoc | none |
| Loading | disables close + button label | rare | none |
| Escape / backdrop | MUI default; blocked when loading | varies | native |
| Focus | `autoFocus` on confirm | varies | native |
| Mobile sizing | `maxWidth="xs"` fullWidth | often not fullScreen on xs | native |

**CANONICAL_DIALOG_CANDIDATE:** Adapt `ClubConfirmDialog` → authenticated ConfirmDialog in 2D. Form dialogs stay domain. 2C/2D may add `fullScreen` on `xs` as a **shared Dialog default** — Wave 6 also cares; Wave 2 can ship the primitive without converting every dialog.

---

## 5. Adoption

| Field | PageHeader | ConfirmDialog |
|-------|------------|---------------|
| NEW_CANONICAL | AuthPageHeader in a shared module path TBD in 2D | AuthConfirmDialog |
| EXISTING_COMPONENT_TO_ADAPT | ClubPageShell | ClubConfirmDialog |
| LEGACY | TournamentPageHeader on non-tournament pages; ad-hoc h5 | window.confirm |
| ADOPTION | 2E: Players, Audit, Support, Dashboard | Replace window.confirm on touched pages only |
| DELETE_WHEN | After Players stops importing TournamentPageHeader | After targeted pages migrated |
| ROLLBACK | Keep ClubPageShell as-is | Keep ClubConfirmDialog |

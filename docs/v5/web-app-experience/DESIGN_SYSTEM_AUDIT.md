# DESIGN_SYSTEM_AUDIT

**Workstream:** web-app-experience-master-closure-01  
**Mode:** AUDIT_ONLY  
**Reference language:** frozen Tournament Experience (`src/features/tournament/experience-a1/visual/tournamentExperienceTokens.js`, primary `#2563EB`).  
**Do not restyle those screens in later waves without Owner GO.**

## DESIGN_TOKEN_SOURCES

| Source | Path | Primary / font | Role today |
|--------|------|----------------|------------|
| Slate Enterprise (claimed SSoT) | `src/theme/designTokens.js` | Green `#10B981`, DM Sans | MUI default app theme |
| MUI theme | `src/theme/theme.js` | From designTokens + hardcoded table greys | Components |
| Figure 1 shell | `src/theme/figure1Tokens.js` + `src/features/canonical-shell/theme/figure1ShellTheme.js` | Blue `#3B82F6`, Inter | Canonical App Shell only |
| Shell re-export | `src/components/shell/shellTokens.js` | Re-exports designTokens | Legacy shell |
| Experience-a1 | `.../tournamentExperienceTokens.js` | Blue `#2563EB` | Frozen tournament screens |
| Domain | `courtCalendarTokens.js`, `clubUiTokens.js`, `sidebarNavTokens.js` | Local palettes | Isolated |

**Three competing primaries:** Slate green vs Figure 1 `#3B82F6` vs Experience `#2563EB`.  
**Two fonts:** DM Sans (app) vs Inter (Canonical shell). Experience uses its own type scale.

Approved untranslated brand tokens (`canonicalVietnameseLabels.js`): PICK_VN, AI, VPR, VPL, VPT, VPC, Zalo OA, API, CRM, QR.

---

## Primitives inventory

| Primitive | Actual implementations |
|-----------|------------------------|
| Typography | MUI + TYPOGRAPHY in designTokens + FIGURE1_TYPOGRAPHY + TOURNAMENT_TYPE |
| Colors | PALETTE / FIGURE1_PALETTE / TOURNAMENT_COLOR + ~453 hex literals under `src/` |
| Spacing | LAYOUT 24px vs FIGURE1 24/16 vs TOURNAMENT_SPACE 12/16 |
| Radius | SHAPE 10 vs FIGURE1 card 12 vs TOURNAMENT_RADIUS control 10 / card 12 / pill 999 |
| Buttons | Raw MUI Button; Experience `primaryActionSx` / `outlinedActionSx`; few wrappers |
| Inputs / selects | MUI TextField/Select; density varies (default vs `size="small"`) |
| Tabs | MUI Tabs (court layout, admin billing, engine) |
| Cards | MUI Paper/Card; Experience cards; Club cards |
| Tables | No shared DataTable. `TournamentListTable`, `ResponsiveDataView`, many raw Tables |
| Dialogs | One-off MUI Dialogs; few `fullScreen` |
| Chips / badges | `ExperienceStatusChip`, `TournamentStatusChip`, `ClubStatusBadge`, `CheckInStatusChip`, `CertifiedTournamentBadge`, `PickVnRatingBadge`, `GovernanceRoleChip`, animation `StatusBadge` |
| Alerts | MUI Alert used as loading **and** error |
| Pagination | Ad-hoc TablePagination |
| Search | GlobalSearch vs CanonicalGlobalSearch vs CourtManagementSearchBar |
| Filters | Per-page Stack of Selects |
| Empty | TournamentEmptyState, DashboardEmptyState, ClubEmptyState, PublicPresentationStates, BillingStateViews, MessagingStateViews, FinanceLedgerStateViews, TournamentUiState |
| Skeleton | ~16 `<Skeleton` usages app-wide |
| Error | Per-feature Alert |
| Toast | MUI Snackbar (sparse) |

---

## DUPLICATE_UI_PRIMITIVES

1. Page headers: TournamentPageHeader / ExperiencePageHeader / CenterPageHeader / ClubPageShell / ad-hoc
2. Empty states: 8+ families
3. Status chips: 7+ families
4. Search: 3
5. App chrome: Canonical vs Legacy
6. Loading: Alert “Đang tải…” vs CircularProgress vs Skeleton

---

## HARDCODED_STYLE_HOTSPOTS

Approximate **453** `#RRGGBB` literals under `src/`.

Hot files/areas:

- Experience draw/media pages (acceptable — frozen tokens duplicated locally)
- `TeamAiPairingDialog.jsx` / `TeamAiPairingConfigBoard.jsx`
- Tournament animation/showcase
- `courtCalendarTokens.js`
- Public portal styles
- Player/court helper color maps
- `theme.js` table header `#F8FAFC` / `#FAFBFC`

---

## DESIGN_SYSTEM_GAPS

| ID | Gap |
|----|-----|
| DS-01 | No single token SSoT used by all modules |
| DS-02 | Production shell (Figure 1 blue/Inter) vs page body (Slate green/DM Sans) |
| DS-03 | Experience language is the best module system but **explicitly isolated** — correct for freeze; Web App rest has not adopted a sibling system |
| DS-04 | No shared Empty / Loading / Error / PageHeader / DataTable / Dialog |
| DS-05 | Button hierarchy inconsistent (contained green vs blue vs size=small) |
| DS-06 | Status colors: Locked/Unlocked EN chips vs Experience VN Nháp/Đang đăng ký |
| DS-07 | Form density: admin tables `small` vs Experience `control` radius 10 |
| DS-08 | Inconsistent radius 8/10/12 |

**Wave 2 implication:** introduce a **Web App** token layer aligned to Experience + Figure 1 (already closer to each other than to Slate green). Do **not** retokenize frozen tournament screens in the same PR as shell work.

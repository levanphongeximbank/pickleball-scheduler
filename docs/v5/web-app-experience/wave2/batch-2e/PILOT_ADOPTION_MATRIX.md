# BATCH 2E — PILOT ADOPTION MATRIX

**WORKSTREAM:** PICK_VN — AUTHENTICATED WEB APP EXPERIENCE  
**WAVE:** WAVE 2 — SHARED DESIGN SYSTEM  
**BATCH:** 2E — REPRESENTATIVE PILOT ADOPTION  
**PR:** #464  
**PRE_HEAD:** `3b4523ef9c2129417d28c33b2b1e3412727e53a2`

## Pilot set

| Pilot | Route | Component | Notes |
|-------|-------|-----------|-------|
| A Dashboard | `/dashboard` | `src/features/dashboard-analytics/components/DashboardAnalyticsView.jsx` | Header + filter + loading/empty/error → Auth*; KPIs/charts preserved |
| B Players | `/players` | `src/pages/Players.jsx` | Removed Tournament header/empty/layout leak; AuthConfirmDialog on delete |
| C Audit | `/audit` | `src/pages/AuditLogPage.jsx` | AuthFilterBar + AuthResponsiveDataView + AppSnackbar + StatusToneChip |
| D Courts | `/court-management/courts` | `src/pages/Courts.jsx` (via CourtManagementCourtsPage) | AuthPageHeader + AuthEmptyState; card registry preserved; **not** CourtCalendarWeekMatrix |

## Per-screen inventory

### A — Dashboard
```
BEFORE_COMPONENTS=StackHeader, DashboardTimeFilter, DashboardLoadingState, DashboardErrorState, DashboardEmptyState, DashboardOverviewKpis, RevenueChart, CourtHeatmap, tables/panels
AFTER_CANONICAL_COMPONENTS=AuthPageHeader, AuthFilterBar, AuthLoadingState, AuthErrorState, AuthEmptyState
PRESERVED_DOMAIN_COMPONENTS=DashboardTimeFilter (composed), DashboardOverviewKpis, RevenueChart, CourtHeatmap, DashboardRecentBookingsTable, DashboardUpcomingTournamentsTable, DashboardRevenueBreakdown, ActionQueuePanel
DATA_BEHAVIOR_CHANGED=NO
AUTH_BEHAVIOR_CHANGED=NO
```

### B — Players
```
BEFORE_COMPONENTS=TournamentPageHeader, TournamentEmptyState, TOURNAMENT_LAYOUT, PlayerFilters, PlayerCard, delete Dialog
AFTER_CANONICAL_COMPONENTS=AuthPageHeader, AuthEmptyState, AuthFilterBar, AuthLoadingState, AuthConfirmDialog
PRESERVED_DOMAIN_COMPONENTS=PlayerStats/PlayerFilters/PlayerCard/import-export, create-edit Dialog, CRUD handlers
DATA_BEHAVIOR_CHANGED=NO
AUTH_BEHAVIOR_CHANGED=NO
PLAYERS_TOURNAMENT_HEADER_LEAK_PRE=1
PLAYERS_TOURNAMENT_HEADER_LEAK_POST=0
PLAYERS_TOURNAMENT_STATE_LEAK_PRE=1
PLAYERS_TOURNAMENT_STATE_LEAK_POST=0
```

### C — Audit
```
BEFORE_COMPONENTS=Typography header, TextField filter, dense Table + nowrap detail cell, Alert message, Chip
AFTER_CANONICAL_COMPONENTS=AuthPageHeader, AuthFilterBar, AuthResponsiveDataView, AppSnackbar, StatusToneChip
PRESERVED_DOMAIN_COMPONENTS=PermissionGate, listAuditLogs / mergeAuditEntries, ACTION_LABELS mapping (page-local tones)
DATA_BEHAVIOR_CHANGED=NO
AUTH_BEHAVIOR_CHANGED=NO
AUDIT_DATA_FIELDS_LOST=0
W6_PAGE_002_STATUS=CLOSED_BY_2E_PILOT
```

### D — Courts list
```
BEFORE_COMPONENTS=Typography header + action buttons, empty Alert, court cards, delete Dialog
AFTER_CANONICAL_COMPONENTS=AuthPageHeader, AuthEmptyState
PRESERVED_DOMAIN_COMPONENTS=court cards, cluster/claim alerts, create/edit/quick-setup dialogs, delete Dialog (confirm pilot reserved to Players), ClubDataTransferPanel
DATA_BEHAVIOR_CHANGED=NO
AUTH_BEHAVIOR_CHANGED=NO
COURT_DOMAIN_HIERARCHY_CHANGED=NO
COURT_AUTHORITY_CHANGED=NO
```

## Adoption counts

```
AUTH_PAGE_HEADER_ADOPTION_COUNT=4
AUTH_FILTER_BAR_ADOPTION_COUNT=3
AUTH_RESPONSIVE_DATA_ADOPTION_COUNT=1
AUTH_STATE_VIEW_ADOPTION_COUNT=5
STATUS_TONE_CHIP_ADOPTION_COUNT=1
AUTH_CONFIRM_DIALOG_ADOPTION_COUNT=1
APP_SNACKBAR_ADOPTION_COUNT=1
CONFIRM_DIALOG_PILOT_COUNT=1
SNACKBAR_PILOT_COUNT=1
```

## Cross-domain UI leak

```
PILOT_CROSS_DOMAIN_UI_LEAK_PRE=3
PILOT_CROSS_DOMAIN_UI_LEAK_POST=0
```

Pre = Players TournamentPageHeader + TournamentEmptyState + TOURNAMENT_LAYOUT.  
Post = 0 inappropriate Tournament/Public imports on the four pilots.

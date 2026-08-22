# TABLE / GRID MATRIX — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY — high priority. Do **not** remediate W6-PAGE-002 in this batch.

```
TABLE_IMPLEMENTATION_COUNT=12
TABLE_WRAPPER_COUNT=2
DATAGRID_USAGE_COUNT=0
CANONICAL_TABLE_STRATEGY_CANDIDATE=MUI Table (theme) + adapt ResponsiveDataView
```

`@mui/x-data-grid` is in `package.json` (^9.6.0) and **never imported** in `src/`.

---

## 1. Implementations

| # | Implementation | File | Kind | ACTION |
|---|----------------|------|------|--------|
| 1 | MUI Table (global styles) | `theme.js` MuiTableHead/Row/Cell | Shared primitive | **KEEP_CANONICAL** |
| 2 | ResponsiveDataView | `src/features/mobile/components/ResponsiveDataView.jsx` | Wrapper: HTML table desktop / cards mobile | **ADAPT_CANONICAL** — promote out of “mobile feature” conceptually in 2D |
| 3 | TournamentListTable | `src/components/tournament/TournamentListTable.jsx` | Domain wrapper | FEATURE_SPECIFIC_KEEP |
| 4 | SeasonStandingsTable | `SeasonStandingsTable.jsx` | Domain | FEATURE_SPECIFIC_KEEP |
| 5 | TeamStandingsTable | `team/TeamStandingsTable.jsx` | Domain | FEATURE_SPECIFIC_KEEP |
| 6 | BracketResultsTable | `bracket/BracketResultsTable.jsx` | Domain | FEATURE_SPECIFIC_KEEP |
| 7–10 | Dashboard tables | TopPlayers, TopCourts, UpcomingTournaments, RecentBookings | Domain | FEATURE_SPECIFIC_KEEP |
| 11 | Experience StandingsTable / DrawLedgerTable | batch D/C surfaces | FROZEN | **FROZEN** |
| 12 | AuditLogPage inline Table | `src/pages/AuditLogPage.jsx` | Page-local | CONSOLIDATE_LATER — **W6-PAGE-002** |

`TABLE_WRAPPER_COUNT=2`: `ResponsiveDataView`, `TournamentListTable` (closest reusable wrappers). Other `*Table*.jsx` are domain grids, not shared systems.

---

## 2. Capability matrix (authenticated)

| Capability | MUI Table + theme | ResponsiveDataView | Domain tables | AuditLogPage |
|------------|-------------------|--------------------|---------------|--------------|
| Header style | uppercase 0.75rem / `#F8FAFC` | 13px weight 800 | varies | default + theme |
| Row height | default + even-row `#FAFBFC` | py 1.25 | varies | `size="small"` |
| Sorting | ad-hoc per page | **no** | some | **no** |
| Filter | page Selects | **no** | some | action Select |
| Pagination UI | **none** (`TablePagination` unused) | **no** | **no** | **no** (load all) |
| Sticky header | rare | **no** | some standings CSS | **no** |
| Empty | per-page | Typography message | domain empty | Alert / empty rows |
| Loading | per-page Alert/spinner | **no** built-in | varies | `loading` flag |
| Error | per-page Alert | **no** | varies | Alert |
| Mobile | overflow / wrap | **cards** | often overflow | nowrap ellipsis |
| Row actions | IconButtons | via render | varies | none |
| Selection | rare | **no** | rare | **no** |
| nowrap | ad-hoc | **no** | ad-hoc | **yes — W6-PAGE-002** |
| Horizontal scroll | common | `overflowX: auto` | common | overflow hidden + ellipsis |

---

## 3. W6-PAGE-002 (documented, not fixed)

Wave 1 Batch 1E: page-owned gap, not shell.

```
ID=W6-PAGE-002
FILE=src/pages/AuditLogPage.jsx
SYMBOL=none (no denseNowrapTable identifier)
CODE=TableCell sx={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
```

Wave 6 owns responsive page tables. Wave 2 2D may supply a wrapper that **supports** wrap vs nowrap as a prop; 2E may pilot AuditLog **without** claiming Wave 6 closed.

Related: W6-PAGE-001 `CourtCalendarWeekMatrix` `minWidth: 900` — calendar, not table primitive.

---

## 4. TABLE_RESPONSIVE_GAPS

1. Most admin/finance/CRM tables are desktop-first horizontal scroll.  
2. No shared pagination control.  
3. `ResponsiveDataView` uses `useIsMobile` (`<900`) — good vs Wave 1 mobile — but tablet 1024 still shows table (OK) with no density token.  
4. Semantic HTML: ResponsiveDataView uses `Box component="table"` (good) but no `caption`. Many MUI Tables lack `aria-label`.  
5. DataGrid unused — **do not** introduce it in Wave 2 unless Owner GO after 2D proves MUI Table insufficient.

---

## 5. Canonical strategy

**Strangler:** keep MUI Table as default; 2D adapt `ResponsiveDataView` into an authenticated shared wrapper (columns, empty, loading, horizontal scroll, optional nowrap). Domain standings/brackets stay domain.

| Field | Value |
|-------|-------|
| NEW_CANONICAL | Thin wrapper around existing ResponsiveDataView + MUI Table |
| EXISTING_COMPONENT_TO_ADAPT | `ResponsiveDataView.jsx` |
| LEGACY_COMPONENTS | All domain `*Table*.jsx`; DataGrid unused dep |
| ADOPTION_APPROACH | 2E: AuditLog + one finance or CRM list; Waves 3–5 convert high-traffic lists |
| DELETE_WHEN | Unused DataGrid dependency only after Owner GO that MUI Table is the strategy |
| ROLLBACK | Stop importing wrapper; pages keep local Table |

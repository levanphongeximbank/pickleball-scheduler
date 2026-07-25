# COACHING-04 — UI Cutover Plan

**Status:** Plan only — no runtime flip in this authoring step  
**Constant:** `COACHING_DURABLE_RUNTIME_DEFAULT = false` (`src/features/coaching/persistence/index.js`)

---

## Runtime modes

| Mode | Meaning | When |
|------|---------|------|
| `legacy` | Pages use `services/coachingService.js` (`pickleball-coaching-v1::{clubId}`) | **Current default** |
| `durable` | Pages use canonical application + durable repositories (COACHING-02 client) under assignment/admin authz | Explicit opt-in after SQL apply + Owner GO |
| `unavailable` | Surface shows blocked / unsupported state (no silent write to the other store) | Durable requested but env/SQL/mapping not ready; or PLAYER self-scope blocked |

### Hard rules

1. **`COACHING_DURABLE_RUNTIME_DEFAULT=false`** until a separate cutover GO.
2. **No silent fallback:** if durable mode is selected and the durable path errors / is unauthorized / mapping blocked → surface `unavailable` (or explicit error), do **not** quietly write legacy LS or pretend success from the other store.
3. Menu/route visibility is not authorization evidence; application + RLS still fail-closed.
4. Phase 28 tables are never a UI backend.

---

## 10-page consumer graph (summary)

All under `src/pages/coaching/`. Shared shell: `CoachingEntityPage.jsx`. Data today: barrel → legacy LS service.

| # | Page file | Route | Primary LS collections | Canonical durable target (future) | Default mode this step |
|---|-----------|-------|------------------------|-----------------------------------|------------------------|
| 1 | `CoachingEntityPage.jsx` | (shell) | N/A — shared CRUD UI | Adapter host for mode switch | `legacy` |
| 2 | `CoachesPage.jsx` | `/coaching/coaches` | `coaches` | `coaching_coach_references` (+ admin assign) | `legacy` |
| 3 | `CoachListPage.jsx` | `/coaching/coach-list` | `coaches` (player/customer browse) | coach refs read — **PLAYER self-scope blocked** | `legacy` / durable → `unavailable` for PLAYER self |
| 4 | `CoachPackageRegisterPage.jsx` | `/coaching/register` | `packages` | packages + enroll/entitlement — **PLAYER mapping blocked** | `legacy` / durable → `unavailable` for PLAYER self |
| 5 | `StudentsPage.jsx` | `/coaching/students` | `students` | relationships + enrollments (assigned/admin) | `legacy` |
| 6 | `ClassesPage.jsx` | `/coaching/classes` | `classes` | programs / curricula | `legacy` |
| 7 | `CoachSchedulePage.jsx` | `/coaching/schedule` | `schedule` | `coaching_training_sessions` | `legacy` |
| 8 | `CoachPackagesPage.jsx` | `/coaching/packages` | `packages` | `coaching_packages` (+ entitlements admin) | `legacy` |
| 9 | `CoachAttendancePage.jsx` | `/coaching/attendance` | `attendance` | `coaching_attendance_records` (+ assigned RPC) | `legacy` |
| 10 | `CoachEvaluationPage.jsx` | `/coaching/evaluations` | `evaluations` | `coaching_evaluations` (+ assigned RPC) | `legacy` |

Consumer edges:

```
Menu (clubCoachingMenu.js)
  → router.jsx routes
    → page components
      → features/coaching barrel
        → coachingService.js (legacy)     [DEFAULT]
        → application + durable repos     [NOT DEFAULT]
```

---

## Page → runtime mapping (cutover intent)

| Page | Admin durable | COACH durable (after COACHING-04 SQL + grants) | PLAYER durable |
|------|---------------|-----------------------------------------------|----------------|
| Coaches | Yes (assign/manage) | Read own coach ref only | N / blocked |
| Coach list | Optional | Optional assigned-visible labels | Blocked → `unavailable` if forced durable |
| Register package | Admin enroll/grant | Consume via assigned RPC only | Blocked → `unavailable` |
| Students | Full | Assigned players only | N |
| Classes | Full | Programs reachable via assignment | N |
| Schedule | Full | Own `coach_reference_id` sessions | N |
| Packages | Full | Definitions tied to assigned players | N |
| Attendance | Full + correction RPC | Assigned record RPC / INSERT policy | N |
| Evaluations | Full | Assigned submit RPC / draft UPDATE | N |
| Entity shell | Mode banner + explicit selector | Same | Same |

---

## Cutover sequence (future execution — not this step)

1. Apply COACHING-02 (+ COACHING-03 certify) on Staging.
2. Apply COACHING-04 helpers / RLS / RPCs / COACH grants (Owner GO).
3. Wire page-level explicit runtime flag (still default `legacy`).
4. Certify admin + COACH assigned flows; confirm PLAYER durable remains `unavailable`.
5. Separate GO to change default / retire LS (`04_*` plan).

---

## Non-goals this step

- No page rewires in `src/pages/coaching/`.
- No change to `COACHING_DURABLE_RUNTIME_DEFAULT`.
- No automatic dual-write.
- No deletion of `coachingService.js`.

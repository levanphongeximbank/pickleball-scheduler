# COACHING-04 — UI Cutover Plan

**Status:** Cutover logic authored — runtime default remains legacy
**Constant:** `COACHING_DURABLE_RUNTIME_DEFAULT = false` (`src/features/coaching/runtime/constants.js`)
**PLAYER mapping status:** `COACHING_04_PLAYER_SELF_SCOPE_AUTHORED_AWAITING_STAGING_GO`

---

## Runtime modes

| Mode | Meaning | When |
|------|---------|------|
| `legacy` | Pages use `services/coachingService.js` (`pickleball-coaching-v1::{clubId}`) | **Current default** |
| `durable` | Canonical application + durable repositories under assignment/admin/self-scope authz | Explicit opt-in after SQL apply + Owner GO |
| `unavailable` | Blocked / unsupported state (no silent write to the other store) | Durable requested but env/SQL/mapping not ready |

### Hard rules

1. **`COACHING_DURABLE_RUNTIME_DEFAULT=false`** until a separate cutover GO.
2. **No silent fallback:** durable error / unauthorized / UNMAPPED → surface ERROR/FORBIDDEN/UNMAPPED; do **not** quietly succeed from legacy LS.
3. PLAYER identity via PM-ID-01 only (`resolveCoachingPlayerSelfScope`).
4. Tenant/club context must be explicit — **no first-club fallback**.
5. States: `LOADING` / `LIVE` / `EMPTY` / `UNMAPPED` / `FORBIDDEN` / `ERROR` (plus INACTIVE/AMBIGUOUS/INVALID).
6. Mock/local data must never present as live durable data.
7. PLAYER durable writes fail closed (read-only contract).
8. Phase 28 tables are never a UI backend.

---

## 10-page consumer graph (summary)

All under `src/pages/coaching/`. Shared shell: `CoachingEntityPage.jsx`.

| # | Page file | Route | Default mode this step | Durable PLAYER note |
|---|-----------|-------|------------------------|---------------------|
| 1 | `CoachingEntityPage.jsx` | (shell) | `legacy` | Mode banner |
| 2 | `CoachesPage.jsx` | `/coaching/coaches` | `legacy` | Admin/COACH |
| 3 | `CoachListPage.jsx` | `/coaching/coach-list` | `legacy` | PLAYER self-read after Staging apply |
| 4 | `CoachPackageRegisterPage.jsx` | `/coaching/register` | `legacy` | PLAYER self-read packages/enrollments |
| 5–10 | Students / Classes / Schedule / Packages / Attendance / Evaluations | `/coaching/*` | `legacy` | COACH assigned / admin |

---

## Cutover sequence (execution — not this authoring PR)

1. Owner grants `COACHING_04_OWNER_GO_APPLY_STAGING`.
2. Apply COACHING-04 forward SQL per `sql-migration-manifest.json` on Staging.
3. Certify admin + COACH + PLAYER self-read; confirm PLAYER mutate remains denied.
4. Separate GO to change durable default / retire LS (`04_*` plan).

---

## Non-goals this step

- No Staging SQL apply.
- No change to `COACHING_DURABLE_RUNTIME_DEFAULT`.
- No deletion of `coachingService.js` / localStorage implementation.
- No automatic dual-write.

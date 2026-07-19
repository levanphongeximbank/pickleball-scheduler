# Phase 1 — Release Readiness

**Status:** Committed — READY WITH CONDITIONS (awaiting Owner push/PR authorization)
**Date:** 2026-07-18
**Branch:** `feature/venue-court-phase-1-foundation`
**Tip commit (runtime):** `7ce80ff24f357ac3d01998378acdf5f58478f3c3`

Companion QA: `docs/venue-court/PHASE_1G_FINAL_QA_REPORT.md`

---

## 1. Phase 1 objective

Establish Venue & Court as the ownership boundary for court inventory, operating hours, and read-only availability — without duplicating Club V3 storage, without rewriting Competition/Court Engine, and without schema migrations.

---

## 2. Completed phases 1A–1G

| Phase | Outcome | Commit |
| ----- | ------- | ------ |
| 1A | Architecture docs | `e3b691c` |
| 1B | Court inventory facade | `73e3738` |
| 1C | Operating hours SSOT consolidation | `733e814` |
| 1D | Courts API sourced from inventory | `e39fbfc` |
| 1E | Canonical `getCourtAvailability` | `23363b1` |
| 1F | Competition availability adapter (unwired) | `7ce80ff` |
| 1G | Final QA + release readiness docs | *(this documentation commit)* |

---

## 3. Commit list

```text
7ce80ff feat(venue-court): add competition availability adapter
23363b1 feat(venue-court): add canonical court availability contract
e39fbfc fix(venue-court): source courts API from canonical inventory
733e814 feat(venue-court): consolidate operating hours source
73e3738 feat(venue-court): add phase 1b court inventory facade
e3b691c docs(venue-court): define phase 1 foundation architecture
```

---

## 4. Files / modules delivered

### Module

`src/features/venue-court/`

- `index.js` — public facade
- `services/courtInventoryService.js`
- `services/venueOperatingHoursService.js`
- `services/courtAvailabilityService.js`
- `adapters/competitionCourtAvailabilityAdapter.js`
- `README.md`

### Integration touchpoints (approved earlier)

- `src/features/api/router/handlers/courtsHandler.js`
- `src/pages/admin/VenueHoursPage.jsx`
- `src/domain/courtManagementSettings.js` (validation / marker helpers)

### Docs

`docs/venue-court/PHASE_1A_*`, `PHASE_1B_*` … `PHASE_1F_*`, `PHASE_1_IMPLEMENTATION_TASKS.md`, plus Phase 1G reports.

### Tests

`tests/venue-court/*` (+ existing booking/court/cluster suites remain green)

---

## 5. Runtime behavior changed

1. **Courts API** lists courts from canonical inventory (`listCourts`), not AI store.
2. **Courts API club scope** — no first-club auto-pick when multiple clubs allowed (`400 CLUB_REQUIRED`).
3. **Venue hours UI** reads/writes through operating-hours facade (CM SSOT); eligibility-gated legacy import only.
4. **New read APIs** available: `getCourtAvailability`, `getCompetitionCourtAvailability` (adapter unused by Competition runtime).

---

## 6. Runtime behavior intentionally unchanged

- Competition / Tournament scheduling and assignment algorithms
- Court Engine session/queue runtime
- Booking create/update/cancel domain semantics
- Club V3 blob schema
- SQL / Supabase / RLS
- Production deploy configuration
- **Competition does not call the new adapter yet**

---

## 7. Deployment impact

| Area | Impact |
| ---- | ------ |
| Frontend bundle | Includes new venue-court module; build PASS |
| API | `/api/v1/courts` inventory source corrected |
| Database | **None** |
| Env / feature flags | **None required** for Phase 1 |
| Breaking risk | Low for single-club tenants; multi-club API clients must send `clubId` |

---

## 8. Rollback boundary

Revert branch commits `73e3738..7ce80ff` (or revert merge commit of the PR) restores pre–Phase 1B+ behavior.

Phase 1A docs-only commit (`e3b691c`) may remain.

Do **not** force-push `main`/`master`. Prefer revert PR if already merged.

---

## 9. Recommended PR title

```text
feat(venue-court): Phase 1 foundation — inventory, hours, availability, Competition adapter
```

---

## 10. Recommended PR description

```markdown
## Summary
- Establish Venue & Court facade for court inventory, operating hours, and read-only availability.
- Correct `/api/v1/courts` to use canonical inventory (no AI store).
- Add Competition-facing availability adapter (not wired into Competition runtime).

## Test plan
- [x] `npm run test:unit` (2729 passed)
- [x] venue-court focused suites (inventory/hours/availability/adapter/API)
- [x] `npm run lint:no-new`
- [x] `npm run build`
- [ ] Manual: Courts API with multi-club token returns 400 without clubId
- [ ] Manual: Venue hours page loads CM hours; legacy warning if ineligible

## Notes
- No SQL/RLS changes.
- Competition adapter is export-only until a future Owner-authorized wiring phase.
```

---

## 11. Recommended merge strategy

1. Owner authorizes push of `feature/venue-court-phase-1-foundation`.
2. Open PR targeting the team’s integration branch (or `main` per Owner).
3. Merge via **merge commit** or **squash** per repo convention — do not rewrite Phase 1 local history after Owner approval of SHAs.
4. Do not enable Competition adapter wiring in the same PR.

---

## 12. Post-merge validation checklist

- [ ] Preview deploy boots
- [ ] `GET /api/v1/courts?clubId=…` returns Club V3 courts
- [ ] Multi-club missing `clubId` → 400 `CLUB_REQUIRED`
- [ ] Unauthorized club → 403
- [ ] Venue hours page shows CM open/close
- [ ] Create booking still conflicts correctly on overlap
- [ ] Tournament schedule/assign still works (no adapter wiring expected)
- [ ] No new SQL migrations applied

---

## 13. Competition adapter wiring status

**Explicit:** `getCompetitionCourtAvailability` is exported and tested, but **no** Competition / Tournament / Director runtime file imports or calls it in Phase 1.

Future wiring requires separate Owner authorization.

---

## 14. Owner decision options

Choose one:

### READY TO PUSH AND OPEN PR

Phase 1G QA PASS; unit suite green; build green; no schema risk; Competition unwired by design.

### READY WITH CONDITIONS

Same as above, plus Owner acknowledges:

- Multi-club API clients must send `clubId`.
- Competition integration is a follow-up phase.
- Legacy hours key cleanup is not part of this PR.

### BLOCKED

Use only if Owner finds a Phase 1 defect requiring code change before push.

---

## QA recommendation

**READY WITH CONDITIONS** — conditions are operational acknowledgements, not open defects.

# S1-B — Registration Lifecycle (Implementation Report)

**Sprint:** Tournament V5 Sprint 1  
**Batch:** S1-B  
**Date:** 2026-07-14  
**Status:** ✅ Implemented — **STOP FOR OWNER REVIEW**

---

## Objective

Close Sprint-1 gaps **S1-GAP-002**, **S1-GAP-004**, **S1-GAP-005**, **S1-GAP-006**, **S1-GAP-012**.

---

## Deliverables

| Requirement | Implementation |
|-------------|----------------|
| Registration window | `settings.registration.{opensAt, closesAt, maxEntries}` + auto-close helpers |
| Entry statuses | `draft \| pending \| approved \| rejected \| waitlisted \| cancelled` (+ legacy `active`) |
| Organizer workflow | Approve / Reject / Waitlist / Promote |
| Capacity → waitlist | Auto waitlist when `maxEntries` full |
| Player self-service | `/tournament/:id/register` — register, cancel, view status, partner invite |
| Lock after draw publish | `isRegistrationLocked()` reads S1-A `settings.draw` publish (read-only) + explicit lock / READY |
| Audit log | `settings.registration.auditLog[]` + identity `writeAuditLog` |
| `?event=` preselect | Type hub → create → setup |

---

## Files

| Path | Change |
|------|--------|
| `src/features/individual-tournament/engines/registrationEngine.js` | **NEW** — core engine |
| `src/features/individual-tournament/index.js` | **NEW** |
| `src/models/tournament/entry.js` | ENTRY_STATUS + workflow fields |
| `src/models/tournament/constants.js` | `ENTRY_STATUS` / labels |
| `src/components/tournament/RegistrationOpsPanel.jsx` | **NEW** — BTC UI |
| `src/pages/tournament/IndividualRegistrationPage.jsx` | **NEW** — player UI |
| `src/pages/tournament/OfficialTournamentSetup.jsx` | Ops panel + `?event=` |
| `src/pages/tournament/InternalTournamentSetup.jsx` | Ops panel + `?event=` |
| `src/pages/tournament/TournamentHome.jsx` | Pass `?event=` into setup |
| `src/pages/tournament/hubs/TournamentSectionPages.jsx` | Preserve `?event=` |
| `src/pages/tournament/hubs/TournamentHubPages.jsx` | Register hub → player page |
| `src/config/tournamentRoutes.js` | Tightened registerable = draft/registration |
| `src/router.jsx` | Route `/tournament/:tournamentId/register` |
| `tests/individual-tournament-registration.test.js` | **NEW** T-S1-B01–B06 |

---

## S1-A untouched

- `publishDrawEngine.js`, `DrawPublishControls.jsx`, `useTournamentEngine.js`, `EngineDrawTab.jsx` — **not modified** (registration only **reads** `isDrawPublished`)
- Draw engine / Rating V5 / Team tournament — **not modified**

---

## Tests

```bash
node --test tests/individual-tournament-registration.test.js
# 8/8 PASS (T-S1-B01–B06 + lock-after-publish + reject/waitlist)

node --test tests/individual-tournament-draw-publish.test.js tests/tournament-regression.test.js
# S1-A + regression PASS
```

---

## Manual QA (owner)

| # | Step | Expected |
|---|------|----------|
| M1 | Set opens/closes + maxEntries on setup | Window persisted |
| M2 | Player registers singles | Entry `pending` |
| M3 | BTC approve / reject / waitlist | Status updates + audit |
| M4 | Full capacity new submit | Auto waitlist; promote when seat free |
| M5 | Doubles: register alone → invite link → partner confirms | Bound pair |
| M6 | Cancel before lock | Entry removed |
| M7 | Publish draw (S1-A) | Registration locked |
| M8 | Nav `?event=men_single` | Preselect on create/setup |

---

## Owner review gate

**Verdict requested:** Approve S1-B → proceed S1-C, or request changes.

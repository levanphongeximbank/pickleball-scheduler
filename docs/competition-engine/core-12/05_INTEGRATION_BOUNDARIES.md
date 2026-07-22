# CORE-12 — Integration Boundaries

**Phase:** 1A design only (1A-R remediated)

**Consistent naming:**

| Id | Canonical name |
|----|----------------|
| CORE-11 | Schedule Engine |
| CORE-12 | Court Assignment |
| CORE-14 | Resource Conflict Resolver |
| Venue availability | Venue & Court **Competition Availability Adapter** (`getCompetitionCourtAvailability` or approved successor) |

Capability-local DTOs (`ScheduledMatchInput`, `AvailableCourtInput`) are **not** automatically upstream public contracts. Snapshot inputs are **not** owned inventory.

---

## 1. Ownership summary

| Concern | Owner |
|---------|-------|
| Assign scheduled matches to courts | **CORE-12 Court Assignment** |
| Prevent overlapping court allocations **inside one assignment request** | **CORE-12** |
| Broader cross-resource / cross-module conflict resolution | **CORE-14 Resource Conflict Resolver** (deferred / optional until public contract stable) |
| Court inventory, operating hours, maintenance, bookings, availability calculation | **Venue & Court Management** via Competition Availability Adapter |
| Match start/end packing / rest | **CORE-11 Schedule Engine** (public contract **not** final on current main) |
| MatchPlan / matchups | **CORE-09** |
| Global optimizer substrate | **CORE-10** (not court assignment; not Phase 1B runtime) |
| Referee assignment | **CORE-13** (planned) |
| Match Lifecycle / scores | Match runtime / product (**not** CORE-14) |
| Business rule evaluation | **CORE-01** |
| Director / publish UI | Product UI (consumes results) |

---

## 2. Boundary with CORE-01 Rule Engine

**Direction:** CORE-12 → consumes evaluated rules via `CourtAssignmentRulePort`.

| Allowed | Forbidden |
|---------|-----------|
| Bind `operation = COURT_ASSIGNMENT` evaluated snapshot | Reimplement Rules V2 inside court-assignment |
| Map hard rules to eligibility / conflicts | Mutate rule definitions |
| Use soft rules as versioned diagnostics / optional scores | Silent ignore of unsupported hard rules |

Existing player-centric rules (`MIN_REST_TIME`, `PLAYER_NOT_BUSY`) remain primarily schedule-time concerns (**CORE-11 Schedule Engine**, when available). CORE-12 may honor them only when supplied as already-evaluated constraints on the request — it does not recompute player rest calendars.

---

## 3. Boundary with CORE-10 Global Optimizer

**Direction:** optional later Integrator wiring via **explicit port/adapter**.

| Fact | Requirement |
|------|-------------|
| Phase 1B greedy assigner | **No CORE-10 runtime dependency** |
| Court assignment ownership | Remains **CORE-12** (validity + result contracts) |
| Court availability ownership | Remains Venue & Court — **not** CORE-10 |
| Pattern reuse | Fingerprint / freeze / PRNG **patterns** may be mirrored capability-locally |

| CORE-10 | CORE-12 |
|---------|---------|
| Generic `DecisionVariable` domains | May later expose court choice domains as snapshots through an explicit adapter |
| Lexicographic objective ranking | Does not own competition-specific fairness objectives |
| Explicit non-ownership of courts | Owns court assignment algorithm and result contracts |

Anti-patterns:

- Importing `optimizer/**` private paths from CORE-12 domain in Phase 1B
- Exporting court assignment from `optimizer/index.js`
- Treating CORE-10 as the court assigner or availability engine
- Hard-wiring CORE-10 as a required runtime for deterministic greedy assignment

---

## 4. Boundary with CORE-11 Schedule Engine

**Status:** current `origin/main` does **not** contain the final CORE-11 implementation or public contract. TE `generateSchedule` remains the legacy joint time+court packer.

**`ScheduledMatchInput` status:** CORE-12 **capability-local normalized DTO** — **not** declared as the final CORE-11 public output. A future anti-corruption adapter or contract-alignment layer may be required. Phase 1B must **not** hard-code unsupported CORE-11 assumptions. **Direct CORE-11 wiring is deferred** until the upstream contract is available on main.

**Target handoff intent (provisional):**

```text
CORE-11 (when public) → scheduled matches with valid absolute intervals (+ timezone), without requiring courtId
CORE-12 consumes → capability-local ScheduledMatchInput[] + Competition Availability snapshot → AssignedCourtSlot[]
```

| CORE-11 owns (when available) | CORE-12 owns |
|-------------------------------|--------------|
| Match order vs dependencies | Court selection |
| Rest gaps between player matches | Court overlap **within the assignment request** |
| Session blocks / day length | Court eligibility against availability snapshot |
| Duration/buffer embedded in windows | Honoring windows as given |

**Migration note:** Until CORE-11’s public contract exists, adapters may normalize legacy TE/schedule payloads into `ScheduledMatchInput` and may strip/ignore legacy `courtId` for parity experiments. Joint packer remains legacy.

---

## 5. Boundary with CORE-13 Referee Assignment

**Direction:** CORE-13 consumes CORE-12 outputs (court + window), does not assign courts.

| Allowed | Forbidden |
|---------|-----------|
| Read `AssignedCourtSlot` | Clearing court to free a referee |
| Referee–court soft preferences via separate request | Embedding referee ids as required CORE-12 outputs |

Historical CE `assignRefereeToCourt` is out of CORE-12 scope.

---

## 6. Boundary with CORE-14 Resource Conflict Resolver

**Identity:** CORE-14 is **Resource Conflict Resolver** — **not** Match Lifecycle.

| Layer | Responsibility |
|-------|----------------|
| **CORE-12** | Prevent overlapping court allocations **inside** its own `CourtAssignmentRequest` / result |
| **CORE-14** | Broader cross-resource or cross-module conflict resolution once its public contract is available |
| CORE-12 must not | Recreate a generic Resource Conflict Resolver |
| Integration | **Deferred and optional** until CORE-14’s contract is merged and stable |

Match Lifecycle / score status machines remain with match runtime / product surfaces — they are **not** reassigned to CORE-14.

---

## 7. Boundary with Venue & Court Management

**Mandatory availability source:** Venue & Court **Competition Availability Adapter** — `getCompetitionCourtAvailability` (or Owner-approved canonical successor).

**Direction:** CORE-12 → consumer-side `CourtAvailabilityPort` → Competition Availability Adapter → immutable `AvailableCourtInput[]` snapshot DTOs.

| Venue & Court owns | CORE-12 owns |
|--------------------|--------------|
| Inventory master status | Using snapshot eligibility |
| Bookings / operating hours / maintenance | Overlap among competition matches **in-run** (request scope) |
| Availability calculation | Assignment decisions and result contracts |
| Tournament booking day-blocks | Per-match court binds |

| Concept | Meaning |
|---------|---------|
| `CourtAvailabilityPort` | Consumer-side boundary only |
| `AvailableCourtInput` | Immutable availability snapshot DTO — not owned inventory |

**Forbidden for CORE-12:**

- Owning inventory, operating hours, maintenance state, booking state, or availability calculation
- Direct writes to venue inventory / commercial bookings as assign side effects
- Fallback to Tournament Engine, Court Engine, UI stores, first venue, first club, or manually reconstructed court inventory
- Bypassing club / venue scope asserts

Tournament booking bridge (`tournamentBookingService`) remains Integrator/venue concern for day-block holds — not the CORE-12 assign algorithm.

**Overnight / operating windows:** current canonical adapter capability does not support overnight operating windows. CORE-12 fails closed on non-representable intervals and does not own upstream overnight policy; future overnight support must arrive through the canonical adapter without recreating availability logic.

---

## 8. Boundary with tournament publication and Director UI

| UI responsibility | CORE-12 responsibility |
|-------------------|------------------------|
| Buttons (“Xếp sân tự động”) | Pure `assignCourts(request)` |
| Manual lock UX | Emit `LockedCourtAssignment` |
| Display conflicts | Render `conflicts` / `unassigned` |
| Live Director one-court occupancy | Separate runtime (`tournament/engines/courtEngine.js`) until Owner merges |

UI must assemble explicit scope ids (`tenantId`/`clubId`/`venueId`/`competitionId`) into the request — never rely on React context inside the domain module. UI stores are not availability sources.

---

## 9. Boundary with audit logging and deterministic seed facilities

| Facility | Integration |
|----------|-------------|
| Fingerprints | CORE-12 result + snapshot refs (CORE-09/10 **pattern** style) |
| Seeded PRNG | Optional capability-local; **not** a CORE-10 runtime dependency for Phase 1B |
| Audit port | Optional append of assignment applied events |
| CE event log | Legacy only — do not call from CORE-12 domain |

---

## 10. Boundary with historical `competition-core/scheduling/`

| scheduling/ (CC-09) | CORE-12 |
|---------------------|---------|
| Schedule envelope + shadow parity | Court assignment domain |
| May include courtId on assignments | Canonical court result type |
| Conflict validate post-hoc | Assignment-time conflict model (in-request) |

Do **not** place CORE-12 implementation under `scheduling/`. New namespace: `court-assignment/`.

---

## 11. Boundary with Court Engine (Daily Play)

Court Engine session auto-assign is a **different product mode** (queue/occupancy).  

Phase 1A decision: **out of CORE-12 ownership**. Not an availability fallback. Optional future adapter for parity only with Owner approval.

---

## 12. Dependency direction diagram

```text
CORE-01 (rules snapshot)
CORE-11 Schedule Engine          Venue & Court Competition
(public contract deferred)       Availability Adapter (mandatory)
        \                               /
         \                             /
          ▼                           ▼
   ScheduledMatchInput           AvailableCourtInput
   (capability-local DTO)        (snapshot DTO via CourtAvailabilityPort)
                          │
                          ▼
                 CORE-12 Court Assignment
                          │
          ┌───────────────┼───────────────────────┐
          ▼               ▼                       ▼
     CORE-13 Ref     CORE-14 Resource        UI / Publish
     (optional)      Conflict Resolver       (adapters)
                     (deferred / optional)
          │
          ▼
     CORE-10 Optimizer (optional explicit port later;
                        NOT Phase 1B runtime)
```

Upstream COREs must not import CORE-12 private paths.  
CORE-12 must not deep-import private implementations of other COREs — only public ports/contracts or Integrator-provided adapters.

---

## 13. Shared-file protection

Phase 1B+ must not modify:

- Other cores’ domain folders
- Root `competition-core/index.js` without Integrator
- Venue SSOT / availability calculation services (consume via Competition Availability Adapter only)
- Unrelated app modules

Allowed documentation path for Phase 1A / 1A-R: `docs/competition-engine/core-12/**` only.

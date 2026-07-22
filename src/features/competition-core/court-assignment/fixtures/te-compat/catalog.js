/**
 * CORE-12 Phase 1C — synthetic Tournament Engine shadow-parity fixtures.
 * No production customer or tournament data.
 */

import { PARITY_CLASSIFICATION } from "../../parity/classifications.js";
import { COURT_AVAILABILITY_STATUS } from "../../enums/availabilityStatus.js";

const TZ = "Asia/Ho_Chi_Minh";
const DAY = "2026-07-22";

function scope(overrides = {}) {
  return {
    tenantId: "tenant-1",
    clubId: "club-1",
    venueId: "venue-1",
    competitionId: "comp-1",
    timezone: TZ,
    ...overrides,
  };
}

function match(id, start, end, overrides = {}) {
  return {
    id,
    scheduledStart: start,
    scheduledEnd: end,
    status: "waiting",
    stage: "group",
    ...overrides,
  };
}

function legacyCourt(id, name, overrides = {}) {
  return {
    id,
    name,
    priority: 0,
    locked: false,
    ...overrides,
  };
}

function snapshot(courtId, overrides = {}) {
  return {
    courtId,
    tenantId: "tenant-1",
    clubId: "club-1",
    venueId: "venue-1",
    availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
    active: true,
    eligible: true,
    priority: 0,
    capabilities: {},
    availabilityIntervals: [
      { start: `${DAY}T00:00:00Z`, end: `${DAY}T23:59:00Z` },
    ],
    ...overrides,
  };
}

function fixture(def) {
  return Object.freeze({
    ...def,
    adapterInput: Object.freeze({ ...def.adapterInput }),
    legacyContext: Object.freeze({ ...def.legacyContext }),
  });
}

/**
 * @returns {ReadonlyArray<object>}
 */
export function createTeParityFixtureCatalog() {
  const catalog = [
    // 1. One match, one eligible court
    fixture({
      id: "F01_one_match_one_court",
      category: 1,
      expectedClassification: PARITY_CLASSIFICATION.EXACT_PARITY,
      expectCore12Valid: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f01",
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
        legacyCourts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 2. Multiple matches, multiple courts
    fixture({
      id: "F02_multi_match_multi_court",
      category: 2,
      expectedClassification: PARITY_CLASSIFICATION.EXACT_PARITY,
      expectCore12Valid: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f02",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
        ],
        courtAvailabilitySnapshots: [
          snapshot("c1", { priority: 10 }),
          snapshot("c2", { priority: 5 }),
        ],
        legacyCourts: [
          legacyCourt("c1", "Court A", { priority: 10 }),
          legacyCourt("c2", "Court B", { priority: 5 }),
        ],
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
        ],
        courts: [
          legacyCourt("c1", "Court A", { priority: 10 }),
          legacyCourt("c2", "Court B", { priority: 5 }),
        ],
      },
    }),

    // 3. Adjacent non-overlapping matches
    fixture({
      id: "F03_adjacent_non_overlap",
      category: 3,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      expectCore12Valid: true,
      divergenceIds: ["HALF_OPEN_INTERVALS"],
      adapterInput: {
        ...scope(),
        requestId: "fix-f03",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:45:00Z`, `${DAY}T11:30:00Z`),
        ],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
        legacyCourts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:45:00Z`, `${DAY}T11:30:00Z`),
        ],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 4. Positive-duration overlap
    fixture({
      id: "F04_positive_overlap",
      category: 4,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      divergenceIds: ["NO_AMBIGUOUS_OK", "PARTIAL_SEMANTICS"],
      expectCore12Valid: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f04",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:30:00Z`, `${DAY}T11:15:00Z`),
        ],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
        policy: { partialAssignmentAllowed: true },
        legacyCourts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:30:00Z`, `${DAY}T11:15:00Z`),
        ],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 5. Court unavailable for full interval
    fixture({
      id: "F05_court_unavailable_full",
      category: 5,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      divergenceIds: ["NO_FIRST_COURT_FALLBACK"],
      allowInfeasible: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f05",
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courtAvailabilitySnapshots: [
          snapshot("c1", {
            priority: 10,
            availabilityStatus: COURT_AVAILABILITY_STATUS.UNAVAILABLE,
            eligible: false,
            availabilityIntervals: [
              { start: `${DAY}T00:00:00Z`, end: `${DAY}T09:00:00Z` },
            ],
          }),
        ],
        legacyCourts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 6. Disabled / ineligible court
    fixture({
      id: "F06_disabled_court",
      category: 6,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      divergenceIds: ["FAIL_CLOSED_SCOPE"],
      allowInfeasible: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f06",
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courtAvailabilitySnapshots: [
          snapshot("c1", {
            priority: 10,
            locked: true,
            eligible: false,
            active: false,
          }),
        ],
        legacyCourts: [legacyCourt("c1", "Court A", { priority: 10, locked: true })],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courts: [legacyCourt("c1", "Court A", { priority: 10, locked: true })],
      },
    }),

    // 7. Multiple venue input (unrepresentable / cross scope)
    fixture({
      id: "F07_multi_venue_input",
      category: 7,
      expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      adapterInput: {
        ...scope(),
        requestId: "fix-f07",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            venueId: "venue-1",
          }),
          match("m2", `${DAY}T11:00:00Z`, `${DAY}T11:45:00Z`, {
            venueId: "venue-2",
          }),
        ],
        courtAvailabilitySnapshots: [
          snapshot("c1", { venueId: "venue-1", priority: 10 }),
          snapshot("c2", { venueId: "venue-2", priority: 10 }),
        ],
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T11:00:00Z`, `${DAY}T11:45:00Z`),
        ],
        courts: [
          legacyCourt("c1", "Court A", { priority: 10 }),
          legacyCourt("c2", "Court B", { priority: 10 }),
        ],
      },
    }),

    // 8. Missing venue scope
    fixture({
      id: "F08_missing_venue_scope",
      category: 8,
      expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      adapterInput: {
        ...scope({ venueId: null }),
        requestId: "fix-f08",
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courtAvailabilitySnapshots: [snapshot("c1")],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courts: [legacyCourt("c1", "Court A")],
      },
    }),

    // 9. Missing scheduled interval
    fixture({
      id: "F09_missing_scheduled_interval",
      category: 9,
      expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      legacyUnsafe: true,
      legacyUnsafeReason:
        "legacy assigns without scheduledStart via first unlocked court",
      divergenceIds: ["NO_FIRST_COURT_FALLBACK"],
      title: "Missing scheduled interval",
      legacyBehaviorUnderTest: "first-court fallback without scheduledStart",
      adapterInput: {
        ...scope(),
        requestId: "fix-f09",
        matches: [{ id: "m1", status: "waiting", stage: "group" }],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
      },
      legacyContext: {
        matches: [{ id: "m1", status: "waiting", stage: "group" }],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 10. Duplicate match ID
    fixture({
      id: "F10_duplicate_match_id",
      category: 10,
      expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      adapterInput: {
        ...scope(),
        requestId: "fix-f10",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m1", `${DAY}T11:00:00Z`, `${DAY}T11:45:00Z`),
        ],
        courtAvailabilitySnapshots: [snapshot("c1")],
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m1", `${DAY}T11:00:00Z`, `${DAY}T11:45:00Z`),
        ],
        courts: [legacyCourt("c1", "Court A")],
      },
    }),

    // 11. Duplicate court ID
    fixture({
      id: "F11_duplicate_court_id",
      category: 11,
      expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      adapterInput: {
        ...scope(),
        requestId: "fix-f11",
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courtAvailabilitySnapshots: [snapshot("c1"), snapshot("c1")],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courts: [legacyCourt("c1", "Court A"), legacyCourt("c1", "Court A2")],
      },
    }),

    // 12. Capability-compatible court
    fixture({
      id: "F12_capability_compatible",
      category: 12,
      expectedClassification: PARITY_CLASSIFICATION.EXACT_PARITY,
      expectCore12Valid: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f12",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            requiredCapabilities: ["indoor"],
          }),
        ],
        courtAvailabilitySnapshots: [
          snapshot("c1", {
            priority: 10,
            capabilities: ["indoor"],
          }),
        ],
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            requiredCapabilities: ["indoor"],
          }),
        ],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 13. Capability-incompatible court
    fixture({
      id: "F13_capability_incompatible",
      category: 13,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      divergenceIds: ["STRUCTURED_CODES"],
      allowInfeasible: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f13",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            requiredCapabilities: ["indoor"],
          }),
        ],
        courtAvailabilitySnapshots: [
          snapshot("c1", {
            priority: 10,
            capabilities: ["outdoor"],
          }),
        ],
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            requiredCapabilities: ["indoor"],
          }),
        ],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 14. Valid locked assignment
    fixture({
      id: "F14_valid_locked_assignment",
      category: 14,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      expectCore12Valid: true,
      divergenceIds: ["LOCK_PRESERVATION"],
      adapterInput: {
        ...scope(),
        requestId: "fix-f14",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            courtId: "c1",
            manualCourtLock: true,
          }),
        ],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            courtId: "c1",
            manualCourtLock: true,
          }),
        ],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 15. Locked assignment overlap (legacy may double-book; CORE-12 conflicts)
    fixture({
      id: "F15_locked_assignment_overlap",
      category: 15,
      expectedClassification: PARITY_CLASSIFICATION.LEGACY_UNSAFE,
      legacyUnsafe: true,
      legacyUnsafeReason:
        "TE does not register manual locks on courtSchedule; auto may double-book",
      divergenceIds: ["LOCK_PRESERVATION"],
      adapterInput: {
        ...scope(),
        requestId: "fix-f15",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            courtId: "c1",
            manualCourtLock: true,
          }),
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
        ],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
        policy: { partialAssignmentAllowed: false },
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            courtId: "c1",
            manualCourtLock: true,
          }),
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
        ],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 16. Unknown locked court
    fixture({
      id: "F16_unknown_locked_court",
      category: 16,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      divergenceIds: ["LOCK_PRESERVATION"],
      allowInfeasible: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f16",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            courtId: "missing-court",
            manualCourtLock: true,
          }),
        ],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            courtId: "missing-court",
            manualCourtLock: true,
          }),
        ],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 17. Partial assignment allowed
    fixture({
      id: "F17_partial_allowed",
      category: 17,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      divergenceIds: ["PARTIAL_SEMANTICS", "NO_AMBIGUOUS_OK"],
      expectCore12Valid: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f17",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
        ],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
        policy: { partialAssignmentAllowed: true },
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
        ],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 18. Partial assignment forbidden
    fixture({
      id: "F18_partial_forbidden",
      category: 18,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      divergenceIds: ["PARTIAL_SEMANTICS", "NO_AMBIGUOUS_OK"],
      allowInfeasible: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f18",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
        ],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
        policy: { partialAssignmentAllowed: false },
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
        ],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 19. Input arrays permuted
    fixture({
      id: "F19_input_permuted",
      category: 19,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      expectCore12Valid: true,
      divergenceIds: ["DET_ORDERING"],
      adapterInput: {
        ...scope(),
        requestId: "fix-f19",
        matches: [
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m1", `${DAY}T11:00:00Z`, `${DAY}T11:45:00Z`),
        ],
        courtAvailabilitySnapshots: [
          snapshot("c2", { priority: 5 }),
          snapshot("c1", { priority: 10 }),
        ],
      },
      legacyContext: {
        matches: [
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m1", `${DAY}T11:00:00Z`, `${DAY}T11:45:00Z`),
        ],
        courts: [
          legacyCourt("c2", "Court B", { priority: 5 }),
          legacyCourt("c1", "Court A", { priority: 10 }),
        ],
      },
    }),

    // 20. Legacy input-order dependence (same priority names differ — locale sort)
    fixture({
      id: "F20_legacy_order_dependence",
      category: 20,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      divergenceIds: ["DET_ORDERING"],
      expectCore12Valid: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f20",
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courtAvailabilitySnapshots: [
          snapshot("c-b", { priority: 1 }),
          snapshot("c-a", { priority: 1 }),
        ],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courts: [
          legacyCourt("c-b", "Sân B", { priority: 1 }),
          legacyCourt("c-a", "Sân A", { priority: 1 }),
        ],
      },
    }),

    // 21. Legacy first-court fallback (no times)
    fixture({
      id: "F21_legacy_first_court_fallback",
      category: 21,
      expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      legacyUnsafe: true,
      legacyUnsafeReason: "legacy first unlocked court without scheduled interval",
      divergenceIds: ["NO_FIRST_COURT_FALLBACK"],
      title: "Legacy first-court fallback",
      legacyBehaviorUnderTest: "missing times → first unlocked court by priority",
      adapterInput: {
        ...scope(),
        requestId: "fix-f21",
        matches: [{ id: "m1", status: "waiting" }],
        courtAvailabilitySnapshots: [
          snapshot("c1", { priority: 1 }),
          snapshot("c2", { priority: 10 }),
        ],
      },
      legacyContext: {
        matches: [{ id: "m1", status: "waiting" }],
        courts: [
          legacyCourt("c1", "Court A", { priority: 1 }),
          legacyCourt("c2", "Court B", { priority: 10 }),
        ],
      },
    }),

    // 22. Legacy ambiguous success heuristic
    fixture({
      id: "F22_legacy_ambiguous_ok",
      category: 22,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      divergenceIds: ["NO_AMBIGUOUS_OK", "PARTIAL_SEMANTICS"],
      allowInfeasible: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f22",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
        ],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
        policy: { partialAssignmentAllowed: false },
      },
      legacyContext: {
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
          match("m2", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`),
        ],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 23. Legacy mutation behavior (harness must not mutate input)
    fixture({
      id: "F23_legacy_mutation_behavior",
      category: 23,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      expectCore12Valid: true,
      divergenceIds: ["NO_INPUT_MUTATION"],
      adapterInput: {
        ...scope(),
        requestId: "fix-f23",
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 24. Empty match set
    fixture({
      id: "F24_empty_match_set",
      category: 24,
      expectedClassification: PARITY_CLASSIFICATION.SEMANTIC_PARITY,
      adapterInput: {
        ...scope(),
        requestId: "fix-f24",
        matches: [],
        courtAvailabilitySnapshots: [snapshot("c1", { priority: 10 })],
      },
      legacyContext: {
        matches: [],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 25. Empty court set
    fixture({
      id: "F25_empty_court_set",
      category: 25,
      expectedClassification: PARITY_CLASSIFICATION.SEMANTIC_PARITY,
      allowInfeasible: true,
      adapterInput: {
        ...scope(),
        requestId: "fix-f25",
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courtAvailabilitySnapshots: [],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courts: [],
      },
    }),

    // 26. Timezone-less legacy time
    fixture({
      id: "F26_timezone_less_time",
      category: 26,
      expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      divergenceIds: ["INVALID_TIME_REJECTION"],
      adapterInput: {
        ...scope(),
        requestId: "fix-f26",
        matches: [
          match("m1", "2026-07-22T10:00:00", "2026-07-22T10:45:00"),
        ],
        courtAvailabilitySnapshots: [snapshot("c1")],
      },
      legacyContext: {
        matches: [
          match("m1", "2026-07-22T10:00:00", "2026-07-22T10:45:00"),
        ],
        courts: [legacyCourt("c1", "Court A")],
      },
    }),

    // 27. Invalid calendar date
    fixture({
      id: "F27_invalid_calendar_date",
      category: 27,
      expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      divergenceIds: ["INVALID_TIME_REJECTION"],
      adapterInput: {
        ...scope(),
        requestId: "fix-f27",
        matches: [
          match("m1", "2026-02-30T10:00:00Z", "2026-02-30T10:45:00Z"),
        ],
        courtAvailabilitySnapshots: [snapshot("c1")],
      },
      legacyContext: {
        matches: [
          match("m1", "2026-02-30T10:00:00Z", "2026-02-30T10:45:00Z"),
        ],
        courts: [legacyCourt("c1", "Court A")],
      },
    }),

    // 28. Cross-tenant / cross-club data
    fixture({
      id: "F28_cross_tenant_club",
      category: 28,
      expectedClassification: PARITY_CLASSIFICATION.UNREPRESENTABLE_LEGACY_INPUT,
      divergenceIds: ["FAIL_CLOSED_SCOPE"],
      adapterInput: {
        ...scope(),
        requestId: "fix-f28",
        matches: [
          match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`, {
            tenantId: "tenant-other",
            clubId: "club-other",
          }),
        ],
        courtAvailabilitySnapshots: [snapshot("c1")],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courts: [legacyCourt("c1", "Court A")],
      },
    }),

    // 29. Multiple availability intervals
    fixture({
      id: "F29_multiple_availability_intervals",
      category: 29,
      expectedClassification: PARITY_CLASSIFICATION.EXACT_PARITY,
      expectCore12Valid: true,
      adapterInput: {
        ...scope(),
        requestId: "fx-f29",
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courtAvailabilitySnapshots: [
          snapshot("c1", {
            priority: 10,
            availabilityIntervals: [
              { start: `${DAY}T08:00:00Z`, end: `${DAY}T09:00:00Z` },
              { start: `${DAY}T10:00:00Z`, end: `${DAY}T12:00:00Z` },
            ],
          }),
        ],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T10:00:00Z`, `${DAY}T10:45:00Z`)],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),

    // 30. Adjacent availability intervals must not be merged
    fixture({
      id: "F30_adjacent_intervals_no_merge",
      category: 30,
      expectedClassification: PARITY_CLASSIFICATION.INTENTIONAL_DIVERGENCE,
      divergenceIds: ["NO_INTERVAL_MERGE"],
      allowInfeasible: true,
      adapterInput: {
        ...scope(),
        requestId: "fx-f30",
        matches: [match("m1", `${DAY}T09:30:00Z`, `${DAY}T10:30:00Z`)],
        courtAvailabilitySnapshots: [
          snapshot("c1", {
            priority: 10,
            availabilityIntervals: [
              { start: `${DAY}T08:00:00Z`, end: `${DAY}T10:00:00Z` },
              { start: `${DAY}T10:00:00Z`, end: `${DAY}T12:00:00Z` },
            ],
          }),
        ],
      },
      legacyContext: {
        matches: [match("m1", `${DAY}T09:30:00Z`, `${DAY}T10:30:00Z`)],
        courts: [legacyCourt("c1", "Court A", { priority: 10 })],
      },
    }),
  ];

  return Object.freeze(catalog);
}

export const TE_PARITY_FIXTURE_CATEGORY_COUNT = 30;

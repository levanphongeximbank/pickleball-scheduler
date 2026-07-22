/**
 * CORE-12 Phase 1C-R — approved intentional divergence catalog.
 * Each entry documents legacy vs CORE-12, reason, risk prevented, fixture IDs.
 */

export const CORE12_DIVERGENCE_CATALOG_V1 = "CORE12_DIVERGENCE_CATALOG_V1";

export const INTENTIONAL_DIVERGENCE_CATALOG = Object.freeze([
  Object.freeze({
    id: "DET_ORDERING",
    title: "Deterministic ordering",
    legacyBehavior:
      "Matches sorted by stage/seed importance; courts by priority then localeCompare(name, 'vi').",
    core12Behavior:
      "Matches/courts sorted by STABLE_PRIORITY_THEN_ID with UTF-16 code-unit comparator (no locale).",
    approvedInvariant: "CORE12_COMPARATOR_V1 locale-independent ordering",
    reason: "Locale and insertion-order drift are non-certified.",
    riskPrevented: "Cross-environment assignment reordering.",
    fixtureIds: Object.freeze(["F19_input_permuted", "F20_legacy_order_dependence"]),
    migrationImpact: "Hosts must stop relying on Vietnamese locale court name ties.",
    migrationCompatibilityRequired: true,
    productionCompatibilityRemaining: true,
  }),
  Object.freeze({
    id: "FAIL_CLOSED_SCOPE",
    title: "Fail-closed scope validation",
    legacyBehavior:
      "clubId optional outside REQUIRED availability mode; venue/tenant/competition often omitted.",
    core12Behavior:
      "Exactly one (tenantId, clubId, venueId, competitionId) required; cross-scope rejected.",
    approvedInvariant: "Single-scope CourtAssignmentRequest",
    reason: "No silent multi-tenant or multi-venue assignment.",
    riskPrevented: "Cross-club / cross-venue court binds.",
    fixtureIds: Object.freeze([
      "F06_disabled_court",
      "F07_multi_venue_input",
      "F08_missing_venue_scope",
      "F28_cross_tenant_club",
    ]),
    migrationImpact: "UI/orchestrator must supply explicit scope ids.",
    migrationCompatibilityRequired: true,
    productionCompatibilityRemaining: true,
  }),
  Object.freeze({
    id: "NO_FIRST_COURT_FALLBACK",
    title: "No hidden first-court fallback",
    legacyBehavior:
      "Matches without scheduledStart skip overlap checks and take the first unlocked court.",
    core12Behavior:
      "Unscheduled / timezone-less / invalid intervals are rejected or unrepresentable.",
    approvedInvariant: "Explicit absolute intervals required",
    reason: "Assignment without an explicit interval is unsafe.",
    riskPrevented: "Phantom occupancy and false 'ok' assignments.",
    fixtureIds: Object.freeze([
      "F05_court_unavailable_full",
      "F09_missing_scheduled_interval",
      "F21_legacy_first_court_fallback",
    ]),
    migrationImpact: "Schedule must materialize absolute intervals before court assign.",
    migrationCompatibilityRequired: true,
    productionCompatibilityRemaining: true,
  }),
  Object.freeze({
    id: "PARTIAL_SEMANTICS",
    title: "Explicit partial-assignment semantics",
    legacyBehavior:
      "ok = no conflicts OR any assignment exists (partial can report ok:true).",
    core12Behavior:
      "SUCCESS | PARTIAL | INFEASIBLE with committable flag; default partialAssignmentAllowed=false.",
    approvedInvariant: "Model B partial diagnostics + committable",
    reason: "Callers must not persist provisional partial sets by accident.",
    riskPrevented: "Ambiguous publish of incomplete court maps.",
    fixtureIds: Object.freeze([
      "F04_positive_overlap",
      "F17_partial_allowed",
      "F18_partial_forbidden",
      "F22_legacy_ambiguous_ok",
    ]),
    migrationImpact: "Map legacy ok through normalizer; never to CORE-12 SUCCESS blindly.",
    migrationCompatibilityRequired: true,
    productionCompatibilityRemaining: true,
  }),
  Object.freeze({
    id: "STRUCTURED_CODES",
    title: "Structured reason codes",
    legacyBehavior: "Vietnamese free-text conflict messages and warnings.",
    core12Behavior: "Canonical COURT_ASSIGNMENT_* rejection/conflict codes.",
    approvedInvariant: "Canonical conflict/rejection code enums",
    reason: "Machine-stable diagnostics for integrators and parity.",
    riskPrevented: "Locale/message-dependent automation failures.",
    fixtureIds: Object.freeze(["F13_capability_incompatible"]),
    migrationImpact: "UI copy can wrap codes; automation must use codes.",
    migrationCompatibilityRequired: false,
    productionCompatibilityRemaining: false,
  }),
  Object.freeze({
    id: "INVALID_TIME_REJECTION",
    title: "Invalid time rejection",
    legacyBehavior:
      "Date parsing of civil/local strings; missing end collapses to start; silent normalize risk.",
    core12Behavior:
      "Absolute instants with Z/offset only; invalid calendar dates rejected; positive duration required.",
    approvedInvariant: "requireAbsoluteInstant + calendar component check",
    reason: "Fail closed on ambiguous time.",
    riskPrevented: "Timezone/calendar skew in court occupancy.",
    fixtureIds: Object.freeze([
      "F26_timezone_less_time",
      "F27_invalid_calendar_date",
    ]),
    migrationImpact: "Normalize legacy times upstream before adapt.",
    migrationCompatibilityRequired: true,
    productionCompatibilityRemaining: true,
  }),
  Object.freeze({
    id: "LOCK_PRESERVATION",
    title: "Lock preservation",
    legacyBehavior:
      "manualCourtLock skips reassignment; invalid locks without courtId are silently skipped; locks not on courtSchedule.",
    core12Behavior:
      "Locks mapped to LockedCourtAssignment; ambiguous locks fail closed; unknown court conflicts; lock occupancy honored.",
    approvedInvariant: "LockedCourtAssignment validation matrix",
    reason: "Locks must be explicit and validated.",
    riskPrevented: "Silent drop of manual director locks / double-book.",
    fixtureIds: Object.freeze([
      "F14_valid_locked_assignment",
      "F15_locked_assignment_overlap",
      "F16_unknown_locked_court",
    ]),
    migrationImpact: "Director locks must include explicit courtId.",
    migrationCompatibilityRequired: true,
    productionCompatibilityRemaining: true,
  }),
  Object.freeze({
    id: "HALF_OPEN_INTERVALS",
    title: "Half-open interval semantics",
    legacyBehavior:
      "Overlap uses aStart < bEnd && bStart < aEnd on Date ms (end collapses to start when missing).",
    core12Behavior: "HALF_OPEN [start, end); adjacent boundaries do not overlap.",
    approvedInvariant: "OVERLAP_MODE HALF_OPEN",
    reason: "Align with certified CORE-12 / availability interval model.",
    riskPrevented: "Double-booking at exact boundaries or zero-length phantom slots.",
    fixtureIds: Object.freeze(["F03_adjacent_non_overlap"]),
    migrationImpact: "Usually compatible for positive-duration matches.",
    migrationCompatibilityRequired: false,
    productionCompatibilityRemaining: false,
  }),
  Object.freeze({
    id: "NO_INPUT_MUTATION",
    title: "No input mutation",
    legacyBehavior:
      "Does not mutate match objects in place; returns a new matches array with courtId writes.",
    core12Behavior:
      "Pure request/result; adapter never mutates legacy input; assigner freezes outputs.",
    approvedInvariant: "Side-effect-free domain surface",
    reason: "Deterministic, side-effect-free domain surface.",
    riskPrevented: "Shared-state races in UI/orchestrator callers.",
    fixtureIds: Object.freeze(["F23_legacy_mutation_behavior"]),
    migrationImpact: "None for pure callers.",
    migrationCompatibilityRequired: false,
    productionCompatibilityRemaining: false,
  }),
  Object.freeze({
    id: "NO_WALL_CLOCK_RANDOM",
    title: "No wall-clock or random IDs",
    legacyBehavior: "No Date.now/Math.random in assignCourts; explain strings only.",
    core12Behavior: "Fingerprints and stable request ids; no wall-clock/random in certified path.",
    approvedInvariant: "Deterministic fingerprint + stable ids",
    reason: "Replayable assignment evidence.",
    riskPrevented: "Non-reproducible audit trails.",
    fixtureIds: Object.freeze(["F01_one_match_one_court"]),
    migrationImpact: "None.",
    migrationCompatibilityRequired: false,
    productionCompatibilityRemaining: false,
  }),
  Object.freeze({
    id: "NO_AMBIGUOUS_OK",
    title: "No ambiguous success heuristic",
    legacyBehavior: "ok = conflicts.length === 0 || assignments.length > 0",
    core12Behavior: "Status enum + committable; never maps partial unsafe sets to SUCCESS.",
    approvedInvariant: "No legacy ok in CORE-12 result contracts",
    reason: "Success must mean policy-satisfying outcome.",
    riskPrevented: "Directors publishing partially conflicted court maps as success.",
    fixtureIds: Object.freeze([
      "F04_positive_overlap",
      "F17_partial_allowed",
      "F18_partial_forbidden",
      "F22_legacy_ambiguous_ok",
    ]),
    migrationImpact: "Normalize legacy ok via LEGACY_SUCCESS_CLASS metadata only.",
    migrationCompatibilityRequired: true,
    productionCompatibilityRemaining: true,
  }),
  Object.freeze({
    id: "NO_INTERVAL_MERGE",
    title: "No silent availability interval merge",
    legacyBehavior: "Live availability checker evaluates civil windows; no CORE-12 snapshot merge.",
    core12Behavior:
      "Match must be fully covered by one availability interval; adjacent intervals are not merged.",
    approvedInvariant: "Single-interval full coverage",
    reason: "Availability ownership stays with Venue & Court snapshots.",
    riskPrevented: "False coverage across gaps.",
    fixtureIds: Object.freeze(["F30_adjacent_intervals_no_merge"]),
    migrationImpact: "Upstream availability snapshots must cover match in one interval.",
    migrationCompatibilityRequired: false,
    productionCompatibilityRemaining: false,
  }),
]);

/**
 * @param {string} id
 */
export function getIntentionalDivergence(id) {
  return INTENTIONAL_DIVERGENCE_CATALOG.find((d) => d.id === id) || null;
}

/**
 * @returns {readonly string[]}
 */
export function listIntentionalDivergenceIds() {
  return Object.freeze(
    INTENTIONAL_DIVERGENCE_CATALOG.map((d) => d.id).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0
    )
  );
}

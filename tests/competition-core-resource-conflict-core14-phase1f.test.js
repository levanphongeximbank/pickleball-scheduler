/**
 * CORE-14 Phase 1F — dormant adapters, projectors, legacy mapping, and shadow parity.
 * Capability-local only; this test is intentionally not wired into Integrator CI manifests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RESOURCE_KIND, SCOPE_TYPE, OCCUPANCY_SOURCE, EVALUATION_STATUS, SEVERITY,
  RESOURCE_FINDING_CODE, INPUT_DIAGNOSTIC_CODE, AVAILABILITY_MODE,
  AVAILABILITY_STATUS, REST_MODE, RESOLUTION_ACTION_TYPE,
  adaptScheduleAssignmentsToResourceOccupancies, adaptCourtAssignmentsToResourceOccupancies,
  adaptRefereeAssignmentsToResourceOccupancies, combineResourceOccupancies,
  adaptAvailabilityAnswersToFacts, projectConflictResultForOptimizer,
  projectConflictResultForSchedule, projectConflictResultForCourtAssignment,
  projectConflictResultForRefereeAssignment, LEGACY_CC09_CONFLICT_CODE,
  mapLegacyConflictCodeToCore14, mapLegacyConflictsToCore14,
  projectCore14FindingsToLegacy, SHADOW_PARITY_CATEGORY,
  compareLegacyAndCore14Conflicts, createResourceOccupancy,
} from "../src/features/competition-core/resource-conflict/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RC_ROOT = path.join(ROOT, "src/features/competition-core/resource-conflict");
const CC_INDEX = path.join(ROOT, "src/features/competition-core/index.js");
const V = "phase1f-test-v1";

function player(id, scopeType = SCOPE_TYPE.EVENT, scopeId = "event-1") {
  return { resourceId: id, scopeType, scopeId };
}
function courtKey(id = "court-1") {
  return { resourceKind: RESOURCE_KIND.COURT, resourceId: id, scopeType: SCOPE_TYPE.VENUE, scopeId: "venue-1" };
}
function refereeKey(id = "ref-1") {
  return { resourceKind: RESOURCE_KIND.REFEREE, resourceId: id, scopeType: SCOPE_TYPE.EVENT, scopeId: "event-1" };
}
function schedule(overrides = {}) {
  return { assignmentId: "schedule-a", matchId: "match-a", players: [player("p1")], startMs: 100, endMs: 200, ...overrides };
}
function assigned(key, overrides = {}) {
  return { assignmentId: "assignment-a", matchId: "match-a", resourceKey: key, startMs: 100, endMs: 200, ...overrides };
}
function finding(code, resourceKey, overrides = {}) {
  return {
    findingId: `finding-${code}-${resourceKey.resourceId}`,
    code, severity: SEVERITY.HARD, resourceKey, occupancyIds: ["occ-a"],
    evidence: { violationStartMs: 100, violationEndMs: 200 }, ...overrides,
  };
}
function run(name, assertion) { test(name, assertion); }
function adapter(fn, records, extra = {}) { return fn({ sourceContractVersion: V, records, ...extra }); }
function jsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? jsFiles(full) : name.endsWith(".js") ? [full] : [];
  });
}
function importedSourceText(file) {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

// ——— SCHEDULE ADAPTER (1–13) ———
run("1. Schedule adapts player occupancy", () => {
  const r = adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule()]);
  assert.equal(r.evaluationStatus, EVALUATION_STATUS.COMPLETED); assert.equal(r.occupancies[0].resourceKey.resourceKind, RESOURCE_KIND.PLAYER);
});
run("2. Schedule adapts team occupancy", () => assert.equal(adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule({ players: [], teams: [player("t1")] })]).occupancies[0].resourceKey.resourceKind, RESOURCE_KIND.TEAM));
run("3. Schedule preserves explicit interval", () => {
  const o = adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule({ startMs: 33, endMs: 44 })]).occupancies[0];
  assert.deepEqual([o.startMs, o.endMs], [33, 44]);
});
run("4. Schedule resolves an explicit slot", () => assert.equal(adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule({ startMs: undefined, endMs: undefined, slotId: "s1" })], { slotResolver: () => ({ startMs: 10, endMs: 20 }) }).occupancies[0].metadata.viaSlot, true));
run("5. Schedule never invents duration", () => assert.equal(adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule({ startMs: undefined, endMs: undefined })]).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT));
run("6. Schedule rejects slot without resolver", () => assert.ok(adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule({ startMs: undefined, endMs: undefined, slotKey: "slot" })]).diagnostics.some((d) => d.code === INPUT_DIAGNOSTIC_CODE.SLOT_RESOLUTION_FAILED)));
run("7. Schedule requires activity identity", () => assert.equal(adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule({ assignmentId: undefined, matchId: undefined })]).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT));
run("8. Schedule rejects missing participant resource", () => assert.equal(adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule({ players: [{}] })]).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT));
run("9. Schedule emits optional location context", () => {
  const record = schedule({
    locationResourceKey: {
      resourceKind: RESOURCE_KIND.LOCATION,
      resourceId: "l1",
      scopeType: SCOPE_TYPE.VENUE,
      scopeId: "venue-1",
    },
  });
  assert.equal(adapter(adaptScheduleAssignmentsToResourceOccupancies, [record]).occupancies.length, 2);
});
run("10. Schedule output source is SCHEDULE", () => assert.equal(adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule()]).occupancies[0].source, OCCUPANCY_SOURCE.SCHEDULE));
run("11. Schedule partial adaptation remains completed", () => {
  const r = adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule(), schedule({ assignmentId: undefined, matchId: undefined })]);
  assert.equal(r.evaluationStatus, EVALUATION_STATUS.COMPLETED); assert.equal(r.metadata.partialAdaptation, true);
});
run("12. Schedule reorder has identical IDs and fingerprint", () => {
  const records = [schedule(), schedule({ assignmentId: "b", matchId: "b", players: [player("p2")] })];
  const a = adapter(adaptScheduleAssignmentsToResourceOccupancies, records), b = adapter(adaptScheduleAssignmentsToResourceOccupancies, [...records].reverse());
  assert.deepEqual(a.occupancies.map((o) => o.occupancyId), b.occupancies.map((o) => o.occupancyId)); assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
});
run("13. Schedule input remains unchanged", () => {
  const input = { sourceContractVersion: V, records: [schedule()] }; const before = structuredClone(input); Object.freeze(input.records[0]);
  adaptScheduleAssignmentsToResourceOccupancies(input); assert.deepEqual(input, before);
});

// ——— COURT ADAPTER (14–21) ———
run("14. Court adapts canonical resource key", () => assert.equal(adapter(adaptCourtAssignmentsToResourceOccupancies, [assigned(courtKey())]).occupancies[0].resourceKey.resourceKind, RESOURCE_KIND.COURT));
run("15. Court adapts courtId shorthand", () => assert.equal(adapter(adaptCourtAssignmentsToResourceOccupancies, [{ assignmentId: "a", courtId: "c", scopeType: SCOPE_TYPE.VENUE, scopeId: "venue-1", startMs: 1, endMs: 2 }]).occupancies[0].resourceKey.resourceId, "c"));
run("16. Court rejects non-court key", () => assert.equal(adapter(adaptCourtAssignmentsToResourceOccupancies, [assigned(refereeKey())]).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT));
run("17. Court rejects invalid time", () => assert.equal(adapter(adaptCourtAssignmentsToResourceOccupancies, [assigned(courtKey(), { endMs: 100 })]).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT));
run("18. Court uses COURT_ASSIGNMENT source", () => assert.equal(adapter(adaptCourtAssignmentsToResourceOccupancies, [assigned(courtKey())]).occupancies[0].source, OCCUPANCY_SOURCE.COURT_ASSIGNMENT));
run("19. Court does not inventory lookup", () => assert.equal(adapter(adaptCourtAssignmentsToResourceOccupancies, [assigned(courtKey())]).metadata.inventoryLookupPerformed, false));
run("20. Court duplicate assignment is rejected", () => {
  const record = assigned(courtKey()); assert.equal(adapter(adaptCourtAssignmentsToResourceOccupancies, [record, record]).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT);
});
run("21. Court freezes copied output", () => assert.equal(Object.isFrozen(adapter(adaptCourtAssignmentsToResourceOccupancies, [assigned(courtKey())]).occupancies[0]), true));

// ——— REFEREE ADAPTER (22–28) ———
run("22. Referee adapts canonical resource key", () => assert.equal(adapter(adaptRefereeAssignmentsToResourceOccupancies, [assigned(refereeKey())]).occupancies[0].resourceKey.resourceKind, RESOURCE_KIND.REFEREE));
run("23. Referee adapts refereeId shorthand", () => assert.equal(adapter(adaptRefereeAssignmentsToResourceOccupancies, [{ assignmentId: "a", refereeId: "r", scopeType: SCOPE_TYPE.EVENT, scopeId: "event-1", startMs: 1, endMs: 2 }]).occupancies[0].resourceKey.resourceId, "r"));
run("24. Referee rejects non-referee key", () => assert.equal(adapter(adaptRefereeAssignmentsToResourceOccupancies, [assigned(courtKey())]).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT));
run("25. Referee preserves lock and published", () => {
  const o = adapter(adaptRefereeAssignmentsToResourceOccupancies, [assigned(refereeKey(), { locked: true, published: true })]).occupancies[0];
  assert.equal(o.locked && o.published, true);
});
run("26. Referee uses REFEREE_ASSIGNMENT source", () => assert.equal(adapter(adaptRefereeAssignmentsToResourceOccupancies, [assigned(refereeKey())]).occupancies[0].source, OCCUPANCY_SOURCE.REFEREE_ASSIGNMENT));
run("27. Referee does not roster lookup", () => assert.equal(adapter(adaptRefereeAssignmentsToResourceOccupancies, [assigned(refereeKey())]).metadata.rosterLookupPerformed, false));
run("28. Referee duplicate assignment is rejected", () => {
  const record = assigned(refereeKey()); assert.equal(adapter(adaptRefereeAssignmentsToResourceOccupancies, [record, record]).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT);
});

// ——— COMPOSITE ADAPTER (29–34) ———
const courtOcc = () => adapter(adaptCourtAssignmentsToResourceOccupancies, [assigned(courtKey())]).occupancies[0];
const refOcc = () => adapter(adaptRefereeAssignmentsToResourceOccupancies, [assigned(refereeKey())]).occupancies[0];
run("29. Composite combines supplied occupancy sets", () => assert.equal(combineResourceOccupancies({ sourceContractVersion: V, courtOccupancies: [courtOcc()], refereeOccupancies: [refOcc()] }).occupancies.length, 2));
run("30. Composite sorts occupancy IDs", () => {
  const r = combineResourceOccupancies({ sourceContractVersion: V, courtOccupancies: [courtOcc()], refereeOccupancies: [refOcc()] });
  assert.deepEqual(r.occupancies.map((o) => o.occupancyId), [...r.occupancies.map((o) => o.occupancyId)].sort());
});
run("31. Composite rejects duplicate IDs", () => {
  const o = courtOcc(); assert.equal(combineResourceOccupancies({ sourceContractVersion: V, courtOccupancies: [o], additionalOccupancies: [o] }).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT);
});
run("32. Composite does not execute detectors", () => assert.equal(combineResourceOccupancies({ sourceContractVersion: V, courtOccupancies: [courtOcc()] }).metadata.detectorsExecuted, false));
run("33. Composite rejects non-array component", () => assert.equal(combineResourceOccupancies({ sourceContractVersion: V, courtOccupancies: {} }).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT));
run("34. Composite copies caller occupancy", () => {
  const o = courtOcc(), r = combineResourceOccupancies({ sourceContractVersion: V, courtOccupancies: [o] }); assert.notEqual(r.occupancies[0], o);
});

// ——— AVAILABILITY ADAPTER (35–42) ———
function availability(status, extra = {}) { return { resourceKey: refereeKey(), startMs: 100, endMs: 200, status, providerVersion: "provider-v1", ...extra }; }
run("35. Availability adapts available fact", () => assert.equal(adapter(adaptAvailabilityAnswersToFacts, [availability(AVAILABILITY_STATUS.AVAILABLE)], { availabilityMode: AVAILABILITY_MODE.ADVISORY }).normalizedAvailabilityFacts.length, 1));
run("36. Availability accepts evaluated interval aliases", () => assert.equal(adapter(adaptAvailabilityAnswersToFacts, [availability(AVAILABILITY_STATUS.AVAILABLE, { startMs: undefined, endMs: undefined, evaluatedStartMs: 1, evaluatedEndMs: 2 })], { availabilityMode: AVAILABILITY_MODE.ADVISORY }).normalizedAvailabilityFacts[0].startMs, 1));
run("37. Unknown remains unknown", () => assert.equal(adapter(adaptAvailabilityAnswersToFacts, [availability(AVAILABILITY_STATUS.UNKNOWN)], { availabilityMode: AVAILABILITY_MODE.ADVISORY }).normalizedAvailabilityFacts[0].status, AVAILABILITY_STATUS.UNKNOWN));
run("38. DATA_UNAVAILABLE maps to unknown", () => assert.equal(adapter(adaptAvailabilityAnswersToFacts, [availability("DATA_UNAVAILABLE")], { availabilityMode: AVAILABILITY_MODE.ADVISORY }).normalizedAvailabilityFacts[0].status, AVAILABILITY_STATUS.UNKNOWN));
run("39. Authoritative unknown is data unavailable", () => assert.equal(adapter(adaptAvailabilityAnswersToFacts, [availability(AVAILABILITY_STATUS.UNKNOWN)], { availabilityMode: AVAILABILITY_MODE.AUTHORITATIVE }).evaluationStatus, EVALUATION_STATUS.DATA_UNAVAILABLE));
run("40. Advisory unknown completes partially", () => {
  const r = adapter(adaptAvailabilityAnswersToFacts, [availability(AVAILABILITY_STATUS.UNKNOWN)], { availabilityMode: AVAILABILITY_MODE.ADVISORY });
  assert.equal(r.evaluationStatus, EVALUATION_STATUS.COMPLETED); assert.equal(r.metadata.availabilityCertification, "PARTIAL");
});
run("41. Availability rejects invalid status", () => assert.equal(adapter(adaptAvailabilityAnswersToFacts, [availability("MAYBE")], { availabilityMode: AVAILABILITY_MODE.ADVISORY }).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT));
run("42. Availability facts are deterministically sorted", () => {
  const a = adapter(adaptAvailabilityAnswersToFacts, [availability(AVAILABILITY_STATUS.AVAILABLE), availability(AVAILABILITY_STATUS.UNAVAILABLE, { resourceKey: courtKey() })], { availabilityMode: AVAILABILITY_MODE.ADVISORY });
  assert.equal(a.normalizedAvailabilityFacts[0].resourceKey.resourceKind, RESOURCE_KIND.COURT);
});

// ——— OPTIMIZER PROJECTOR (43–49) ———
const playerFinding = () => finding(RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP, { resourceKind: RESOURCE_KIND.PLAYER, ...player("p1") });
const courtFinding = () => finding(RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP, courtKey());
const recommendation = (type = RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME) => ({ recommendationId: `rec-${type}`, actionType: type, rootFindingIds: ["finding"], automaticEligible: true, requiresManualApproval: false, proposedChanges: [] });
run("43. Optimizer separates hard constraints", () => assert.equal(projectConflictResultForOptimizer({ findings: [playerFinding()] }).hardConstraints.length, 1));
run("44. Optimizer separates soft penalties", () => assert.equal(projectConflictResultForOptimizer({ findings: [{ ...playerFinding(), severity: SEVERITY.SOFT }] }).softPenalties.length, 1));
run("45. Optimizer projects local candidates", () => assert.equal(projectConflictResultForOptimizer({ recommendations: [recommendation()] }).candidateLocalMoves.length, 1));
run("46. Optimizer never calculates global score", () => assert.equal(projectConflictResultForOptimizer({}).globalObjectiveScore, null));
run("47. Optimizer never selects recommendation", () => assert.equal(projectConflictResultForOptimizer({}).selectedRecommendationId, null));
run("48. Optimizer preserves caller weights only", () => assert.deepEqual(projectConflictResultForOptimizer({ callerPolicyWeights: { w: 2 } }).callerPolicyWeights, { w: 2 }));
run("49. Optimizer invalid input returns diagnostic", () => assert.equal(projectConflictResultForOptimizer(null).diagnostics[0].code, INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID));

// ——— CONSUMER PROJECTORS (50–63) ———
run("50. Schedule projector includes player overlap", () => assert.equal(projectConflictResultForSchedule({ findings: [playerFinding()] }).findings.length, 1));
run("51. Schedule projector excludes court overlap", () => assert.equal(projectConflictResultForSchedule({ findings: [courtFinding()] }).findings.length, 0));
run("52. Schedule projector permits time recommendation", () => assert.equal(projectConflictResultForSchedule({ recommendations: [recommendation()] }).recommendations.length, 1));
run("53. Schedule projector is not applied", () => assert.equal(projectConflictResultForSchedule({}).applied, false));
run("54. Schedule projector has no assignment mutation instructions", () => assert.equal(projectConflictResultForSchedule({}).metadata.includesCourtMutationInstructions, false));
run("55. Court projector includes court overlap", () => assert.equal(projectConflictResultForCourtAssignment({ findings: [courtFinding()] }).findings.length, 1));
run("56. Court projector excludes player overlap", () => assert.equal(projectConflictResultForCourtAssignment({ findings: [playerFinding()] }).findings.length, 0));
run("57. Court projector permits court reassignment", () => assert.equal(projectConflictResultForCourtAssignment({ recommendations: [recommendation(RESOLUTION_ACTION_TYPE.REASSIGN_COURT)] }).recommendations.length, 1));
run("58. Court projector selects no court", () => assert.equal(projectConflictResultForCourtAssignment({}).selectedCourtId, null));
run("59. Court projector is not applied", () => assert.equal(projectConflictResultForCourtAssignment({}).applied, false));
const refFinding = () => finding(RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP, refereeKey());
run("60. Referee projector includes referee overlap", () => assert.equal(projectConflictResultForRefereeAssignment({ findings: [refFinding()] }).findings.length, 1));
run("61. Referee projector preserves hard overlap", () => assert.equal(projectConflictResultForRefereeAssignment({ findings: [refFinding({ severity: SEVERITY.SOFT })] }).findings[0].severity, SEVERITY.HARD));
run("62. Referee projector selects no referee", () => assert.equal(projectConflictResultForRefereeAssignment({}).selectedRefereeId, null));
run("63. Referee projector is not applied", () => assert.equal(projectConflictResultForRefereeAssignment({}).applied, false));

// ——— LEGACY MAPPING (64–71) ———
run("64. Legacy player conflict maps", () => assert.equal(mapLegacyConflictCodeToCore14(LEGACY_CC09_CONFLICT_CODE.PLAYER_TIME_CONFLICT).core14Code, RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP));
run("65. Legacy court conflict maps", () => assert.equal(mapLegacyConflictCodeToCore14(LEGACY_CC09_CONFLICT_CODE.COURT_TIME_CONFLICT).core14Code, RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP));
run("66. Legacy mandatory rest maps", () => assert.equal(mapLegacyConflictCodeToCore14(LEGACY_CC09_CONFLICT_CODE.INSUFFICIENT_REST, { restMode: REST_MODE.MANDATORY }).core14Code, RESOURCE_FINDING_CODE.MANDATORY_REST_VIOLATION));
run("67. Legacy preferred rest maps", () => assert.equal(mapLegacyConflictCodeToCore14(LEGACY_CC09_CONFLICT_CODE.INSUFFICIENT_REST, { restMode: REST_MODE.PREFERRED }).core14Code, RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING));
run("68. Legacy rest without policy is unmapped", () => assert.equal(mapLegacyConflictCodeToCore14(LEGACY_CC09_CONFLICT_CODE.INSUFFICIENT_REST).mapped, false));
run("69. Legacy workflow code is unmapped", () => assert.equal(mapLegacyConflictCodeToCore14(LEGACY_CC09_CONFLICT_CODE.UNASSIGNED_MATCH).mapped, false));
run("70. Legacy batch mapping is deterministic", () => {
  const a = mapLegacyConflictsToCore14({ conflicts: [{ code: LEGACY_CC09_CONFLICT_CODE.PLAYER_TIME_CONFLICT }, { code: LEGACY_CC09_CONFLICT_CODE.COURT_TIME_CONFLICT }] });
  const b = mapLegacyConflictsToCore14({ conflicts: [{ code: LEGACY_CC09_CONFLICT_CODE.COURT_TIME_CONFLICT }, { code: LEGACY_CC09_CONFLICT_CODE.PLAYER_TIME_CONFLICT }] }); assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
});
run("71. CORE-14 projects mapped findings to legacy", () => assert.equal(projectCore14FindingsToLegacy({ findings: [playerFinding()] }).conflicts[0].code, LEGACY_CC09_CONFLICT_CODE.PLAYER_TIME_CONFLICT));

// ——— SHADOW PARITY (72–80) ———
const legacyPlayer = (extra = {}) => ({ code: LEGACY_CC09_CONFLICT_CODE.PLAYER_TIME_CONFLICT, resourceId: "p1", assignmentId: "occ-a", startMs: 100, endMs: 200, severity: SEVERITY.HARD, ...extra });
run("72. Shadow reports matched conflict", () => assert.equal(compareLegacyAndCore14Conflicts({ legacyConflicts: [legacyPlayer()], core14Findings: [playerFinding()] }).counts.MATCHED, 1));
run("73. Shadow reports CORE14-only", () => assert.equal(compareLegacyAndCore14Conflicts({ legacyConflicts: [], core14Findings: [playerFinding()] }).counts.CORE14_ONLY, 1));
run("74. Shadow reports legacy-only", () => assert.equal(compareLegacyAndCore14Conflicts({ legacyConflicts: [legacyPlayer()], core14Findings: [] }).counts.LEGACY_ONLY, 1));
run("75. Shadow reports semantic mismatch", () => assert.equal(compareLegacyAndCore14Conflicts({ legacyConflicts: [legacyPlayer({ severity: SEVERITY.SOFT })], core14Findings: [playerFinding()] }).counts.SEMANTIC_MISMATCH, 1));
run("76. Shadow reports unmappable legacy code", () => assert.equal(compareLegacyAndCore14Conflicts({ legacyConflicts: [{ code: LEGACY_CC09_CONFLICT_CODE.UNASSIGNED_MATCH }], core14Findings: [] }).counts.UNMAPPABLE_LEGACY_CODE, 1));
run("77. Shadow reports insufficient legacy evidence", () => assert.equal(compareLegacyAndCore14Conflicts({ legacyConflicts: [legacyPlayer({ startMs: undefined, endMs: undefined })], core14Findings: [] }).counts.INSUFFICIENT_LEGACY_EVIDENCE, 1));
run("78. Shadow parity categories are frozen vocabulary", () => assert.equal(SHADOW_PARITY_CATEGORY.MATCHED, "MATCHED"));
run("79. Shadow does not change plan status", () => assert.equal(compareLegacyAndCore14Conflicts({ core14PlanStatus: "BLOCKED", legacyConflicts: [], core14Findings: [] }).core14PlanStatusUnchanged, true));
run("80. Shadow does not suppress CORE-14 findings", () => assert.equal(compareLegacyAndCore14Conflicts({ legacyConflicts: [], core14Findings: [] }).core14FindingsSuppressed, false));

// ——— ADAPTER CONTRACT (81–88) ———
run("81. Adapters require source contract version", () => assert.equal(adaptScheduleAssignmentsToResourceOccupancies({ records: [] }).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT));
run("82. Adapters reject non-array records", () => assert.equal(adaptCourtAssignmentsToResourceOccupancies({ sourceContractVersion: V, records: {} }).evaluationStatus, EVALUATION_STATUS.REJECTED_INVALID_INPUT));
run("83. Adapter results expose deterministic fingerprints", () => assert.match(adapter(adaptRefereeAssignmentsToResourceOccupancies, [assigned(refereeKey())]).deterministicFingerprint, /^[a-f0-9]{64}$/));
run("84. Adapter results freeze occupancy arrays", () => assert.equal(Object.isFrozen(adapter(adaptScheduleAssignmentsToResourceOccupancies, [schedule()]).occupancies), true));
run("85. Adapters preserve source version", () => assert.equal(adapter(adaptCourtAssignmentsToResourceOccupancies, [assigned(courtKey())]).sourceContractVersion, V));
run("86. Empty valid adapter input completes", () => assert.equal(adapter(adaptScheduleAssignmentsToResourceOccupancies, []).evaluationStatus, EVALUATION_STATUS.COMPLETED));
run("87. Occupancy factory remains available", () => assert.equal(typeof createResourceOccupancy, "function"));
run("88. Resolution action vocabulary remains available", () => assert.equal(RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME, "MOVE_ASSIGNMENT_TIME"));

// ——— ARCHITECTURE AND REGRESSION (89–104) ———
run("89. Resource-conflict has no UI imports", () => jsFiles(RC_ROOT).forEach((f) => assert.equal(/from\s+["'][^"']*(react|pages\/)/i.test(importedSourceText(f)), false, f)));
run("90. Resource-conflict has no persistence imports", () => jsFiles(RC_ROOT).forEach((f) => assert.equal(/supabase/i.test(importedSourceText(f)), false, f)));
run("91. Resource-conflict has no schedule generator imports", () => jsFiles(RC_ROOT).forEach((f) => assert.equal(/scheduleEngine|calculateCanonicalSchedule/.test(importedSourceText(f)), false, f)));
run("92. Resource-conflict has no court selector imports", () => jsFiles(RC_ROOT).forEach((f) => assert.equal(/courtAssignmentEngine/.test(importedSourceText(f)), false, f)));
run("93. Resource-conflict has no referee selector imports", () => jsFiles(RC_ROOT).forEach((f) => assert.equal(/refereeAssignEngine/.test(importedSourceText(f)), false, f)));
run("94. Resource-conflict has no optimizer evaluator imports", () => jsFiles(RC_ROOT).forEach((f) => assert.equal(/evaluateObjective|objectives\/evaluate/.test(importedSourceText(f)), false, f)));
run("95. Resource-conflict has no production availability imports", () => jsFiles(RC_ROOT).forEach((f) => assert.equal(/competitionCourtAvailabilityAdapter|courtAvailabilityService|clubStorage/.test(importedSourceText(f)), false, f)));
run("96. Resource-conflict has no adjacent core imports", () => jsFiles(RC_ROOT).forEach((f) => assert.equal(/competition-core\/(optimizer|scheduling)/.test(importedSourceText(f)), false, f)));
run("97. Competition-core root does not export resource-conflict", () => assert.equal(readFileSync(CC_INDEX, "utf8").includes("resource-conflict"), false));
run("98. Phase 1F nondeterministic APIs are absent", () => ["adapters", "projectors", "legacy", "shadow"].flatMap((d) => jsFiles(path.join(RC_ROOT, d))).forEach((f) => assert.equal(/Date\.now|Math\.random/.test(readFileSync(f, "utf8")), false, f)));
run("99. Phase 1F has no automatic apply API", () => jsFiles(RC_ROOT).forEach((f) => assert.equal(/applyRecommendation/.test(readFileSync(f, "utf8")), false, f)));
run("100. Phase 1C regression file exists", () => assert.equal(existsSync(path.join(ROOT, "tests/competition-core-resource-conflict-core14-phase1c.test.js")), true));
run("101. Phase 1D regression file exists", () => assert.equal(existsSync(path.join(ROOT, "tests/competition-core-resource-conflict-core14-phase1d.test.js")), true));
run("102. Phase 1E regression file exists", () => assert.equal(existsSync(path.join(ROOT, "tests/competition-core-resource-conflict-core14-phase1e.test.js")), true));
run("103. Phase 1F remains separately runnable", () => assert.equal(existsSync(path.join(ROOT, "tests/competition-core-resource-conflict-core14-phase1f.test.js")), true));
run("104. Frozen caller input remains unchanged", () => {
  const input = { sourceContractVersion: V, records: [assigned(courtKey())] }; const before = structuredClone(input);
  Object.freeze(input.records[0]); Object.freeze(input.records); Object.freeze(input);
  adaptCourtAssignmentsToResourceOccupancies(input); assert.deepEqual(input, before);
});

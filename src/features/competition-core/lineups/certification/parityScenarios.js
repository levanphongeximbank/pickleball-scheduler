/**
 * CORE-06 Phase 1F — parity scenario catalog (fixtures + expected classifications).
 * No Production wiring. No TT runtime imports.
 *
 * ACCEPTED_DIFFERENCE rows must carry an allowlisted differenceCode.
 */

import { LINEUP_SHADOW_CLASSIFICATION } from "../contracts/shadowComparison.js";
import {
  LINEUP_ACCEPTED_DIFFERENCE_CODE,
  isLineupAcceptedDifferenceCode,
} from "../contracts/acceptedDifferences.js";

/**
 * @typedef {Object} LineupParityScenario
 * @property {string} id
 * @property {string} title
 * @property {object} input
 * @property {string} expectedCanonicalBehavior
 * @property {string} expectedLegacyBehavior
 * @property {string} parityClassification
 * @property {string} rationale
 * @property {string|null} [differenceCode]
 */

/** @type {ReadonlyArray<LineupParityScenario>} */
export const LINEUP_PARITY_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "P1",
    title: "Draft lineup creation",
    input: { status: "draft", commandType: "create" },
    expectedCanonicalBehavior: "createLineup → DRAFT revision 1 PRIVATE",
    expectedLegacyBehavior: "save_draft / not_submitted→draft",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Status alias draft↔DRAFT is frozen",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P2",
    title: "Captain submit before deadline",
    input: { status: "draft", phase: "OPEN" },
    expectedCanonicalBehavior: "submit allowed in OPEN window",
    expectedLegacyBehavior: "canSubmit true before lineupLockAt",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Deadline injection preserves open-window submit",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P3",
    title: "Submit during grace period",
    input: { phase: "GRACE_PERIOD" },
    expectedCanonicalBehavior: "policy-gated late mutation",
    expectedLegacyBehavior: "format-specific late submit",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
    differenceCode: LINEUP_ACCEPTED_DIFFERENCE_CODE.GRACE_POLICY_INJECTION,
    rationale: "Grace permission is format-injected in CORE-06",
  }),
  Object.freeze({
    id: "P4",
    title: "Submit after grace expiry",
    input: { phase: "CLOSED" },
    expectedCanonicalBehavior: "LINEUP_SUBMISSION_DEADLINE_PASSED",
    expectedLegacyBehavior: "deadline_passed",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Both fail closed after deadline",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P5",
    title: "Lock before reveal",
    input: { lockAt: "T1", revealAt: "T2", evaluatedAt: "T1" },
    expectedCanonicalBehavior: "mutationPhase LOCKED; revealEligible false",
    expectedLegacyBehavior: "locked; opponent still hidden",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Lock does not imply reveal",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P6",
    title: "Lock and reveal eligibility overlap",
    input: { lockAt: "T1", revealAt: "T1", evaluatedAt: "T1" },
    expectedCanonicalBehavior: "LOCKED + revealEligible true (separate)",
    expectedLegacyBehavior: "locked; publish may still be required for opponent",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
    differenceCode:
      LINEUP_ACCEPTED_DIFFERENCE_CODE.REVEAL_VS_PUBLISH_DIMENSIONS,
    rationale: "CORE-06 separates revealEligible from publish lifecycle",
  }),
  Object.freeze({
    id: "P7",
    title: "Opponent hidden before publish",
    input: { visibilityState: "PRIVATE" },
    expectedCanonicalBehavior: "projection hidden for OPPONENT",
    expectedLegacyBehavior: "opponentLineup null",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Fail-closed opponent hide",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P8",
    title: "Officials-visible only",
    input: { visibilityState: "OFFICIALS_VISIBLE" },
    expectedCanonicalBehavior: "officials may see; opponent/public hidden",
    expectedLegacyBehavior: "BTC/ref visibility product rules",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
    differenceCode:
      LINEUP_ACCEPTED_DIFFERENCE_CODE.OFFICIALS_VISIBILITY_MATRIX,
    rationale: "TT role matrix vs CORE-06 visibility states",
  }),
  Object.freeze({
    id: "P9",
    title: "Public reveal after authorization",
    input: { visibilityState: "PUBLIC", revealAuthorized: true },
    expectedCanonicalBehavior: "explicit PUBLIC transition + policy",
    expectedLegacyBehavior: "published matchup visibility",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
    differenceCode: LINEUP_ACCEPTED_DIFFERENCE_CODE.PUBLIC_VISIBILITY_ENUM,
    rationale: "PUBLIC is canonical-only enum; TT uses publish",
  }),
  Object.freeze({
    id: "P10",
    title: "Stale expectedVersion",
    input: { expectedVersion: 1, current: 3 },
    expectedCanonicalBehavior: "LINEUP_STALE_COMMAND / VERSION_CONFLICT",
    expectedLegacyBehavior: "version conflict",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Optimistic concurrency parity",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P11",
    title: "Missing expectedVersion when required",
    input: { requiresExpectedVersion: true },
    expectedCanonicalBehavior: "LINEUP_EXPECTED_VERSION_REQUIRED",
    expectedLegacyBehavior: "validation requires expectedVersion",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Both fail closed when required",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P12",
    title: "Same idempotency key replay",
    input: { idempotencyKey: "k1", samePayload: true },
    expectedCanonicalBehavior: "replayed true; no version bump",
    expectedLegacyBehavior: "idempotent replay",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Replay semantics align",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P13",
    title: "Same key with different payload",
    input: { idempotencyKey: "k1", samePayload: false },
    expectedCanonicalBehavior: "LINEUP_IDEMPOTENCY_CONFLICT",
    expectedLegacyBehavior: "idempotency_payload_mismatch",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Conflict fail closed",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P14",
    title: "Locked correction denied by default",
    input: { allowsLockedCorrection: false },
    expectedCanonicalBehavior: "LINEUP_MUTATION_NOT_ALLOWED",
    expectedLegacyBehavior: "BTC override with permission",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
    differenceCode: LINEUP_ACCEPTED_DIFFERENCE_CODE.CORRECTION_DEFAULT_DENY,
    rationale: "CORE-06 hardens default deny; TT grants via role permissions",
  }),
  Object.freeze({
    id: "P15",
    title: "Locked correction explicitly authorized",
    input: { allowsLockedCorrection: true, reason: "repair" },
    expectedCanonicalBehavior: "override/correct succeeds with audit",
    expectedLegacyBehavior: "override with reason",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Authorized correction path",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P16",
    title: "Random fallback with deterministic seed",
    input: { seed: "owner-seed" },
    expectedCanonicalBehavior: "Phase 1D deterministic select (semantic)",
    expectedLegacyBehavior: "TT product randomize engine",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
    differenceCode: LINEUP_ACCEPTED_DIFFERENCE_CODE.RNG_SEMANTIC_ONLY,
    rationale:
      "Semantic determinism only — no exact bit-parity claim across engines",
  }),
  Object.freeze({
    id: "P17",
    title: "Random fallback replay",
    input: { seed: "owner-seed", idempotencyKey: "r1" },
    expectedCanonicalBehavior: "same resolution on replay within CORE-06 engine",
    expectedLegacyBehavior: "idempotent randomize within TT engine",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Idempotent random path within each engine",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P18",
    title: "Cross-tenant access rejection",
    input: { viewerTenant: "other" },
    expectedCanonicalBehavior: "LINEUP_CROSS_SCOPE_ACCESS_DENIED",
    expectedLegacyBehavior: "cross_tenant_denied / RLS",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Tenant isolation",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P19",
    title: "Cross-competition access rejection",
    input: { viewerCompetition: "other" },
    expectedCanonicalBehavior: "LINEUP_CROSS_SCOPE_ACCESS_DENIED",
    expectedLegacyBehavior: "scope denied",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Competition isolation",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P20",
    title: "OWN_TEAM scope mismatch rejection",
    input: { relationship: "OWN_TEAM", viewerTeamId: "other" },
    expectedCanonicalBehavior: "projection fail closed",
    expectedLegacyBehavior: "captain_scope_denied",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Relationship must match team scope",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P21",
    title: "Unsupported legacy state",
    input: { status: "mystery_state" },
    expectedCanonicalBehavior: "UNSUPPORTED_LINEUP_STATUS",
    expectedLegacyBehavior: "invalid status",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Reject unknown states",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P22",
    title: "Ambiguous lineup identity",
    input: { identityKey: "wrong" },
    expectedCanonicalBehavior: "LINEUP_IDENTITY_MISMATCH",
    expectedLegacyBehavior: "identity collision/mismatch",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "Deterministic identity enforcement",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P23",
    title: "Void/cancel mapping",
    input: { status: "withdrawn" },
    expectedCanonicalBehavior: "VOIDED",
    expectedLegacyBehavior: "withdrawn",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.MATCH,
    rationale: "withdrawn→VOIDED alias frozen",
    differenceCode: null,
  }),
  Object.freeze({
    id: "P24",
    title: "Legacy field missing from canonical requirement",
    input: { missing: "tenantId" },
    expectedCanonicalBehavior: "LINEUP_SCOPE_REQUIRED",
    expectedLegacyBehavior: "may infer club/tournament scope",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
    differenceCode: LINEUP_ACCEPTED_DIFFERENCE_CODE.TENANT_EXPLICIT_REQUIRED,
    rationale: "CORE-06 refuses tenant inference; TT may derive scope",
  }),
  Object.freeze({
    id: "P25",
    title: "Canonical-only field not representable in legacy output",
    input: { field: "commandFingerprint" },
    expectedCanonicalBehavior: "fingerprints retained canonically",
    expectedLegacyBehavior: "field absent",
    parityClassification: LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE,
    differenceCode:
      LINEUP_ACCEPTED_DIFFERENCE_CODE.CANONICAL_FINGERPRINT_ABSENT_IN_LEGACY,
    rationale: "Listed in CANONICAL_FIELDS_NOT_IN_LEGACY",
  }),
]);

/**
 * Validate catalog integrity. Fail closed on duplicates / invalid accepted rows.
 * @param {ReadonlyArray<LineupParityScenario>} [scenarios]
 */
export function validateParityCatalog(scenarios = LINEUP_PARITY_SCENARIOS) {
  const issues = [];
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    issues.push({ code: "EMPTY_CATALOG", message: "Parity catalog is empty" });
    return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  }
  const seen = new Set();
  for (const s of scenarios) {
    if (!s || typeof s !== "object" || !s.id) {
      issues.push({ code: "INVALID_SCENARIO", message: "Scenario missing id" });
      continue;
    }
    if (seen.has(s.id)) {
      issues.push({
        code: "DUPLICATE_SCENARIO_ID",
        message: `Duplicate scenario id: ${s.id}`,
      });
    }
    seen.add(s.id);
    if (
      s.parityClassification === LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE
    ) {
      if (!isLineupAcceptedDifferenceCode(s.differenceCode)) {
        issues.push({
          code: "UNKNOWN_ACCEPTED_DIFFERENCE",
          message: `Scenario ${s.id} lacks allowlisted differenceCode`,
        });
      }
    }
  }
  return Object.freeze({
    ok: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

/**
 * Summarize parity catalog counts from actual scenario rows (allowlist-aware).
 * Invalid accepted rows are counted as blocking.
 * @param {ReadonlyArray<LineupParityScenario>} [scenarios]
 */
export function summarizeParityCatalog(scenarios = LINEUP_PARITY_SCENARIOS) {
  const validation = validateParityCatalog(scenarios);
  const counts = {
    matched: 0,
    acceptedDifferences: 0,
    blockingDifferences: 0,
    insufficientData: 0,
  };
  if (!validation.ok) {
    // Structural catalog failure → all blocking for certification purposes.
    return Object.freeze({
      total: Array.isArray(scenarios) ? scenarios.length : 0,
      matched: 0,
      acceptedDifferences: 0,
      blockingDifferences: Math.max(1, scenarios?.length || 1),
      insufficientData: 0,
      validation,
    });
  }
  for (const s of scenarios) {
    if (s.parityClassification === LINEUP_SHADOW_CLASSIFICATION.MATCH) {
      counts.matched += 1;
    } else if (
      s.parityClassification === LINEUP_SHADOW_CLASSIFICATION.ACCEPTED_DIFFERENCE
    ) {
      if (isLineupAcceptedDifferenceCode(s.differenceCode)) {
        counts.acceptedDifferences += 1;
      } else {
        counts.blockingDifferences += 1;
      }
    } else if (
      s.parityClassification === LINEUP_SHADOW_CLASSIFICATION.BLOCKING_DIFFERENCE
    ) {
      counts.blockingDifferences += 1;
    } else {
      counts.insufficientData += 1;
    }
  }
  return Object.freeze({
    total: scenarios.length,
    ...counts,
    validation,
  });
}

/**
 * CORE-19 Workflow Engine — Phase 1C decision composition + dependency adapters.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WORKFLOW_ERROR_CODE,
  createTransitionAuthorizationDecision,
  createTransitionPrerequisiteResult,
  createTransitionGuardDecision,
  composeAuthorizationDecision,
  composePrerequisiteResults,
  composeGuardDecisions,
  adaptCore01GuardDecision,
  adaptCore15MatchPrerequisite,
  adaptCore16ScoringSignal,
  adaptCore17ResultValidationGate,
  adaptCore18StandingsCompletion,
  createWorkflowPayloadFingerprint,
} from "../src/features/competition-core/workflow/index.js";

import { RULES_DECISION_STATUS } from "../src/features/competition-core/constraints/index.js";
import { MATCH_STATUS } from "../src/features/competition-core/matches/index.js";
import { SCORING_EVENT_TYPE } from "../src/features/competition-core/scoring/index.js";
import {
  ACCEPTANCE_STATUS,
  LINEAGE_STATUS,
  RESULT_TYPE,
} from "../src/features/competition-core/result-validation/index.js";
import {
  STANDINGS_WARNING_CODE,
  STANDINGS_ERROR_CODE,
} from "../src/features/competition-core/standings/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_ROOT = path.join(ROOT, "src/features/competition-core/workflow");
const ADAPTERS_ROOT = path.join(WORKFLOW_ROOT, "adapters");

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

describe("CORE-19 Phase 1C — decision composition", () => {
  it("1. multiple authorization decisions all allow", () => {
    const composed = composeAuthorizationDecision([
      { allowed: true, actorId: "a2", decisionCode: "B", reason: "ok-b" },
      { allowed: true, actorId: "a1", decisionCode: "A", reason: "ok-a" },
    ]);
    assert.equal(composed.allowed, true);
    assert.equal(composed.details.missingAuthorizationContext, false);
  });

  it("2. one authorization denial blocks", () => {
    const composed = composeAuthorizationDecision([
      { allowed: true, actorId: "a1", decisionCode: "ALLOW", reason: "ok" },
      {
        allowed: false,
        actorId: "a2",
        decisionCode: "DENIED_ROLE",
        reason: "role-denied",
        details: { decisionId: "d-deny" },
      },
    ]);
    assert.equal(composed.allowed, false);
    assert.equal(composed.details.actorDenial, true);
    assert.ok(composed.details.denialReasons.includes("role-denied"));
  });

  it("3. missing mandatory authorization context blocks", () => {
    const composed = composeAuthorizationDecision([]);
    assert.equal(composed.allowed, false);
    assert.equal(composed.decisionCode, "MISSING_AUTHORIZATION_CONTEXT");
    assert.equal(composed.details.missingAuthorizationContext, true);
  });

  it("4. multiple prerequisites all satisfied", () => {
    const composed = composePrerequisiteResults([
      { satisfied: true, code: "P2", message: "second" },
      { satisfied: true, code: "P1", message: "first" },
    ]);
    assert.equal(composed.satisfied, true);
    assert.equal(composed.results.length, 2);
    assert.deepEqual(
      composed.results.map((r) => r.code),
      ["P1", "P2"]
    );
  });

  it("5. one mandatory prerequisite failure blocks", () => {
    const composed = composePrerequisiteResults([
      { satisfied: true, code: "P1" },
      {
        satisfied: false,
        code: "P_FAIL",
        message: "not ready",
        dependencyRef: "core-18:standings",
        details: { prerequisiteId: "prereq-fail" },
      },
    ]);
    assert.equal(composed.satisfied, false);
    assert.deepEqual(composed.failedPrerequisiteIds, ["prereq-fail"]);
    assert.ok(composed.blockingReasons.includes("not ready"));
  });

  it("6. non-blocking prerequisite warning is preserved", () => {
    const composed = composePrerequisiteResults([
      { satisfied: true, code: "P1" },
      {
        satisfied: true,
        code: STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE,
        message: "tie warning",
        details: { warning: true, nonBlocking: true, warnings: ["tie warning"] },
      },
    ]);
    assert.equal(composed.satisfied, true);
    assert.ok(composed.warnings.includes("tie warning"));
  });

  it("7. multiple guards all allow", () => {
    const composed = composeGuardDecisions([
      { allowed: true, code: "G2", message: "g2" },
      { allowed: true, code: "G1", message: "g1" },
    ]);
    assert.equal(composed.allowed, true);
    assert.deepEqual(
      composed.decisions.map((d) => d.code),
      ["G1", "G2"]
    );
  });

  it("23. stable ordering of composed reasons", () => {
    const a = composePrerequisiteResults([
      { satisfied: false, code: "Z", message: "zeta" },
      { satisfied: false, code: "A", message: "alpha" },
    ]);
    const b = composePrerequisiteResults([
      { satisfied: false, code: "A", message: "alpha" },
      { satisfied: false, code: "Z", message: "zeta" },
    ]);
    assert.deepEqual(a.blockingReasons, b.blockingReasons);
    assert.deepEqual(a.blockingReasons, ["alpha", "zeta"]);
  });
});

describe("CORE-19 Phase 1C — dependency adapters", () => {
  it("8. CORE-01 hard rejection maps to guard denial", () => {
    const decision = adaptCore01GuardDecision({
      evaluation: {
        feasible: false,
        eligible: false,
        hardViolations: [
          { reasonCode: "HARD_BLOCK", message: "hard conflict" },
        ],
        conflicts: [],
        softScore: 0,
        validation: { ok: false },
      },
      decisionId: "g-01",
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, WORKFLOW_ERROR_CODE.GUARD_REJECTED);
    assert.equal(decision.details.decisionStatus, RULES_DECISION_STATUS.REJECTED);
    assert.ok(decision.details.ruleCodes.includes("HARD_BLOCK"));
  });

  it("9. CORE-01 soft/advisory result does not silently hard-deny", () => {
    const decision = adaptCore01GuardDecision({
      evaluation: {
        feasible: true,
        eligible: true,
        hardViolations: [],
        conflicts: [],
        softScore: -12,
        softNotes: [{ reasonCode: "SOFT_NOTE", message: "prefer other" }],
        validation: { ok: true },
      },
      mandatoryBlocking: true,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.details.advisory, true);
    assert.equal(decision.details.softScore, -12);
    assert.equal(decision.details.hardDenial, false);
  });

  it("10. CORE-15 all required matches completed", () => {
    const result = adaptCore15MatchPrerequisite({
      matches: [
        { matchId: "m2", status: MATCH_STATUS.COMPLETED },
        { matchId: "m1", status: MATCH_STATUS.COMPLETED },
      ],
      prerequisiteId: "matches-done",
    });
    assert.equal(result.satisfied, true);
    assert.deepEqual(result.details.completedMatchIds, ["m1", "m2"]);
  });

  it("11. CORE-15 one required match incomplete", () => {
    const result = adaptCore15MatchPrerequisite({
      matches: [
        { matchId: "m1", status: MATCH_STATUS.COMPLETED },
        { matchId: "m2", status: MATCH_STATUS.IN_PROGRESS },
      ],
    });
    assert.equal(result.satisfied, false);
    assert.equal(result.code, WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED);
    assert.ok(result.details.incompleteMatchIds.includes("m2"));
  });

  it("12. CORE-15 suspended or cancelled state is represented without duplicating lifecycle logic", () => {
    const suspended = adaptCore15MatchPrerequisite({
      matches: [{ matchId: "m1", status: MATCH_STATUS.SUSPENDED }],
    });
    const cancelled = adaptCore15MatchPrerequisite({
      transitionResult: {
        ok: true,
        matchId: "m2",
        toStatus: MATCH_STATUS.CANCELLED,
        match: { matchId: "m2", status: MATCH_STATUS.CANCELLED },
      },
    });
    assert.equal(suspended.satisfied, false);
    assert.ok(suspended.details.suspendedMatchIds.includes("m1"));
    assert.equal(cancelled.satisfied, false);
    assert.ok(cancelled.details.cancelledMatchIds.includes("m2"));
    assert.equal(suspended.details.usesCanonicalMatchStatus, true);
  });

  it("13. CORE-16 match-completed signal permits validation progression only", () => {
    const result = adaptCore16ScoringSignal({
      event: {
        eventId: "evt-1",
        eventType: SCORING_EVENT_TYPE.MATCH_COMPLETED,
        sequence: 1,
      },
    });
    assert.equal(result.satisfied, true);
    assert.equal(result.details.permitsValidationProgression, true);
    assert.equal(result.details.impliesValidatedResult, false);
    assert.equal(result.details.impliesStandingsReadiness, false);
  });

  it("14. CORE-16 projection does not imply validated result", () => {
    const result = adaptCore16ScoringSignal({
      projection: {
        projectionKind: "CALCULATED_SCORE_ONLY",
        calculatedMatchComplete: true,
        validatedFinalResult: false,
      },
    });
    assert.equal(result.satisfied, false);
    assert.equal(result.details.impliesValidatedResult, false);
    assert.equal(result.details.permitsValidationProgression, false);
  });

  it("15. CORE-17 accepted active standings-safe result passes", () => {
    const result = adaptCore17ResultValidationGate({
      validatedResult: {
        acceptanceStatus: ACCEPTANCE_STATUS.ACCEPTED,
        lineageStatus: LINEAGE_STATUS.ACTIVE,
        resultType: RESULT_TYPE.COMPLETED,
        validatedResultId: "vr-1",
        matchId: "m1",
        sideA: { entryId: "e1" },
        sideB: { entryId: "e2" },
      },
    });
    assert.equal(result.satisfied, true);
    assert.equal(result.details.standingsSafe, true);
  });

  it("16. CORE-17 rejected result blocks", () => {
    const result = adaptCore17ResultValidationGate({
      result: {
        acceptanceStatus: ACCEPTANCE_STATUS.REJECTED,
        lineageStatus: LINEAGE_STATUS.ACTIVE,
        resultType: RESULT_TYPE.COMPLETED,
      },
    });
    assert.equal(result.satisfied, false);
    assert.ok(
      result.details.blockingReasons.some((r) => /REJECTED/.test(r))
    );
  });

  it("17. CORE-17 correction-required result blocks", () => {
    const result = adaptCore17ResultValidationGate({
      result: {
        acceptanceStatus: ACCEPTANCE_STATUS.CORRECTION_REQUIRED,
        lineageStatus: LINEAGE_STATUS.ACTIVE,
        resultType: RESULT_TYPE.COMPLETED,
      },
    });
    assert.equal(result.satisfied, false);
    assert.ok(
      result.details.blockingReasons.some((r) => /CORRECTION_REQUIRED/.test(r))
    );
  });

  it("18. CORE-17 superseded lineage blocks", () => {
    const result = adaptCore17ResultValidationGate({
      result: {
        acceptanceStatus: ACCEPTANCE_STATUS.ACCEPTED,
        lineageStatus: LINEAGE_STATUS.SUPERSEDED,
        resultType: RESULT_TYPE.COMPLETED,
      },
    });
    assert.equal(result.satisfied, false);
    assert.ok(
      result.details.blockingReasons.some((r) => /SUPERSEDED/.test(r))
    );
  });

  it("19. CORE-18 clean deterministic standings result passes", () => {
    const result = adaptCore18StandingsCompletion({
      standingsResult: {
        ok: true,
        typedErrors: [],
        typedWarnings: [],
        warnings: [],
        rows: [
          { entryId: "e1", rank: 1 },
          { entryId: "e2", rank: 2 },
        ],
      },
    });
    assert.equal(result.satisfied, true);
    assert.equal(result.details.completeFinalOrdering, true);
  });

  it("20. CORE-18 unresolved-tie warning with complete stable ranking passes with warning", () => {
    const result = adaptCore18StandingsCompletion({
      standingsResult: {
        ok: true,
        typedErrors: [],
        typedWarnings: [
          { code: STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE },
        ],
        warnings: [STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE],
        rows: [
          { entryId: "e1", rank: 1 },
          { entryId: "e2", rank: 2 },
        ],
      },
    });
    assert.equal(result.satisfied, true);
    assert.equal(result.details.nonBlockingUnresolvedTie, true);
    assert.ok(
      result.details.warnings.includes(
        STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE
      )
    );
  });

  it("21. CORE-18 unresolved tie without complete stable ranking blocks", () => {
    const result = adaptCore18StandingsCompletion({
      standingsResult: {
        ok: true,
        typedErrors: [],
        typedWarnings: [
          { code: STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE },
        ],
        rows: [
          { entryId: "e1", rank: 1 },
          { entryId: "e2" },
        ],
      },
    });
    assert.equal(result.satisfied, false);
    assert.equal(result.code, WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED);
  });

  it("22. CORE-18 typed error blocks", () => {
    const result = adaptCore18StandingsCompletion({
      standingsResult: {
        ok: false,
        typedErrors: [
          {
            code: STANDINGS_ERROR_CODE.STANDINGS_INVALID_REQUEST,
            message: "bad request",
          },
        ],
        rows: [{ entryId: "e1", rank: 1 }],
      },
    });
    assert.equal(result.satisfied, false);
    assert.ok(result.details.typedErrorCodes.length > 0);
  });

  it("24. adapter input objects are not mutated", () => {
    const matches = [{ matchId: "m1", status: MATCH_STATUS.COMPLETED }];
    const snap = JSON.stringify(matches);
    adaptCore15MatchPrerequisite({ matches });
    assert.equal(JSON.stringify(matches), snap);

    const projection = {
      projectionKind: "CALCULATED_SCORE_ONLY",
      calculatedMatchComplete: true,
    };
    const projectionSnap = JSON.stringify(projection);
    adaptCore16ScoringSignal({ projection });
    assert.equal(JSON.stringify(projection), projectionSnap);

    const standingsResult = {
      ok: true,
      typedErrors: [],
      rows: [{ entryId: "e1", rank: 1 }],
    };
    const standingsSnap = JSON.stringify(standingsResult);
    adaptCore18StandingsCompletion({ standingsResult });
    assert.equal(JSON.stringify(standingsResult), standingsSnap);
  });

  it("25. same logical input with different object key order produces equal normalized output", () => {
    const a = adaptCore15MatchPrerequisite({
      prerequisiteId: "p1",
      matches: [
        { status: MATCH_STATUS.COMPLETED, matchId: "m1" },
        { matchId: "m2", status: MATCH_STATUS.COMPLETED },
      ],
    });
    const b = adaptCore15MatchPrerequisite({
      matches: [
        { matchId: "m2", status: MATCH_STATUS.COMPLETED },
        { matchId: "m1", status: MATCH_STATUS.COMPLETED },
      ],
      prerequisiteId: "p1",
    });
    assert.equal(
      createWorkflowPayloadFingerprint(a),
      createWorkflowPayloadFingerprint(b)
    );

    const authA = composeAuthorizationDecision([
      { reason: "ok", allowed: true, decisionCode: "A", actorId: "x" },
      { actorId: "y", decisionCode: "B", allowed: true, reason: "ok2" },
    ]);
    const authB = composeAuthorizationDecision([
      { allowed: true, actorId: "y", reason: "ok2", decisionCode: "B" },
      { decisionCode: "A", allowed: true, reason: "ok", actorId: "x" },
    ]);
    assert.deepEqual(authA, authB);
  });

  it("26. no adapter performs persistence or dependency state mutation", () => {
    const files = listJsFiles(ADAPTERS_ROOT);
    assert.ok(files.length > 0);
    const forbidden = [
      /applyMatchTransition\s*\(/,
      /recordPoint\s*\(/,
      /executeScoringCommand\s*\(/,
      /acceptMatchResult\s*\(/,
      /finalizeValidatedResult\s*\(/,
      /calculateCanonicalStandings\s*\(/,
      /Date\.now\s*\(/,
      /Math\.random\s*\(/,
      /supabase/i,
      /localStorage/,
      /fetch\s*\(/,
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        assert.equal(
          pattern.test(text),
          false,
          `${path.relative(ROOT, file)} matched ${pattern}`
        );
      }
    }
  });

  it("27. no deep dependency imports", () => {
    const files = listJsFiles(ADAPTERS_ROOT);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map(
        (m) => m[1]
      );
      for (const spec of imports) {
        if (spec.startsWith("../contracts/") || spec.startsWith("../errors/") || spec.startsWith("../utils/")) {
          continue;
        }
        if (spec.startsWith("../../")) {
          assert.match(
            spec,
            /\/index\.js$/,
            `${path.relative(ROOT, file)} must import dependency barrel only: ${spec}`
          );
          assert.equal(
            /\/(services|adapters|domain|internal)\//.test(spec),
            false,
            `${path.relative(ROOT, file)} deep-imports dependency: ${spec}`
          );
        }
      }
    }
  });

  it("helpers remain constructible for Phase 1B contracts", () => {
    assert.equal(
      createTransitionAuthorizationDecision({ allowed: true }).allowed,
      true
    );
    assert.equal(
      createTransitionPrerequisiteResult({ satisfied: true }).satisfied,
      true
    );
    assert.equal(
      createTransitionGuardDecision({ allowed: true }).allowed,
      true
    );
  });
});

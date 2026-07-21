import { deepFreeze, deepFreezeClone } from "../domain/deepFreeze.js";
import {
  ELIGIBILITY_STATUS,
  FINALIZATION_STATE,
} from "../domain/constants.js";
import { buildSeedingScopeKey } from "../domain/normalizeSeedingScope.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
  normalizeOpaqueId,
} from "../domain/normalizeHelpers.js";
import {
  getSnapshotThroughPort,
} from "../ports/RankingRatingSnapshotProviderPort.js";

/**
 * Apply eligibility decisions to candidate list (no noop fallback).
 *
 * @param {{
 *   candidates: ReadonlyArray<object>,
 *   scope: object,
 *   eligibilityPort: object,
 *   effectiveAt: string|number,
 *   requireDefinite?: boolean,
 * }} args
 * @returns {{ candidates: object[], decisionsByEntryId: Record<string, object> }}
 */
export function applyEligibilityDecisions(args) {
  const entryIds = args.candidates.map((c) => String(c.entryId));
  let resolved;
  try {
    resolved = args.eligibilityPort.resolveDecisions({
      seedingScope: args.scope,
      entryIds,
      effectiveAt: args.effectiveAt,
    });
  } catch (err) {
    if (err && typeof err === "object" && /** @type {{code?:string}} */ (err).code) {
      throw err;
    }
    throwSeedingError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "EligibilityDecisionPort.resolveDecisions failed",
      {
        message: err instanceof Error ? err.message : String(err),
      }
    );
  }

  if (!resolved || resolved.ok === false) {
    throwSeedingError(
      SEEDING_ERROR_CODE.ELIGIBILITY_REQUIRED,
      "EligibilityDecisionPort returned a failed decision set"
    );
  }

  const mapRaw = resolved.decisionsByEntryId;
  /** @type {Record<string, object>} */
  const decisionsByEntryId = {};
  if (mapRaw instanceof Map) {
    for (const [k, v] of mapRaw.entries()) decisionsByEntryId[String(k)] = v;
  } else if (mapRaw && typeof mapRaw === "object") {
    Object.assign(decisionsByEntryId, mapRaw);
  }

  const scopeKey = buildSeedingScopeKey(
    /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
      args.scope
    )
  );
  const requireDefinite = args.requireDefinite !== false;

  const enriched = args.candidates.map((candidate) => {
    const entryId = String(candidate.entryId);
    const decision = decisionsByEntryId[entryId];
    if (!decision) {
      throwSeedingError(
        SEEDING_ERROR_CODE.ELIGIBILITY_REQUIRED,
        "Missing required eligibility decision for entry",
        { entryId }
      );
    }
    const decisionId = normalizeOpaqueId(decision.decisionId || decision.id);
    if (!decisionId) {
      throwSeedingError(
        SEEDING_ERROR_CODE.ELIGIBILITY_DECISION_MISMATCH,
        "eligibility decisionId is required",
        { entryId }
      );
    }
    const status = String(decision.status || "");
    if (
      status !== ELIGIBILITY_STATUS.ELIGIBLE &&
      status !== ELIGIBILITY_STATUS.INELIGIBLE &&
      status !== ELIGIBILITY_STATUS.UNKNOWN
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.ELIGIBILITY_DECISION_MISMATCH,
        "eligibility status is invalid",
        { entryId, status }
      );
    }
    if (status === ELIGIBILITY_STATUS.UNKNOWN && requireDefinite) {
      throwSeedingError(
        SEEDING_ERROR_CODE.ELIGIBILITY_REQUIRED,
        "UNKNOWN eligibility fails closed when a definite decision is required",
        { entryId }
      );
    }

    const decisionScope =
      decision.scope || decision.seedingScope || decision.scopeRef;
    if (decisionScope) {
      const dKey = buildSeedingScopeKey(
        /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
          {
            competitionId: decisionScope.competitionId,
            competitionVersionId:
              decisionScope.competitionVersionId ?? null,
            divisionId: decisionScope.divisionId ?? null,
            categoryId: decisionScope.categoryId ?? null,
            stageId: decisionScope.stageId ?? null,
            entryType:
              decisionScope.entryType ||
              /** @type {{entryType?:string}} */ (args.scope).entryType,
          }
        )
      );
      if (dKey !== scopeKey) {
        throwSeedingError(
          SEEDING_ERROR_CODE.ELIGIBILITY_DECISION_MISMATCH,
          "eligibility decision scope does not match integration scope",
          { entryId, decisionScopeKey: dKey, scopeKey }
        );
      }
    }

    if (
      decision.entryId != null &&
      String(decision.entryId) !== entryId
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.ELIGIBILITY_DECISION_MISMATCH,
        "eligibility decision entryId mismatch",
        { entryId, decisionEntryId: decision.entryId }
      );
    }

    return {
      ...candidate,
      eligibilityStatus: status,
      eligibilityReasonCodes: Array.isArray(decision.reasonCodes)
        ? decision.reasonCodes.slice()
        : [],
      eligibilityDecisionProvenance: deepFreeze({
        decisionId,
        status,
        policyOrRuleProvenance:
          decision.policyOrRuleProvenance ||
          decision.decisionVersion ||
          null,
        evaluatedAt: decision.evaluatedAt || decision.decidedAt || null,
        sourceModule: decision.sourceModule || null,
        sourceVersion: decision.sourceVersion || decision.decisionVersion || null,
      }),
    };
  });

  return {
    candidates: enriched,
    decisionsByEntryId: deepFreeze(decisionsByEntryId),
  };
}

/**
 * @param {{
 *   scope: object,
 *   candidates: object[],
 *   ruleEvaluationPort: object,
 *   effectiveAt: string|number,
 * }} args
 */
export function applyRuleEvaluation(args) {
  let resolved;
  try {
    resolved = args.ruleEvaluationPort.evaluateSeedingRules({
      seedingScope: args.scope,
      candidates: args.candidates,
      operation: "SEEDING",
      effectiveAt: args.effectiveAt,
    });
  } catch (err) {
    if (err && typeof err === "object" && /** @type {{code?:string}} */ (err).code) {
      throw err;
    }
    throwSeedingError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "RuleEvaluationPort.evaluateSeedingRules failed",
      { message: err instanceof Error ? err.message : String(err) }
    );
  }

  if (!resolved || !resolved.ruleSetId || !resolved.ruleSetVersion) {
    throwSeedingError(
      SEEDING_ERROR_CODE.RULE_EVALUATION_REQUIRED,
      "Rule evaluation result missing ruleSet identity"
    );
  }
  if (resolved.ok === false) {
    throwSeedingError(
      SEEDING_ERROR_CODE.RULE_EVALUATION_REQUIRED,
      "Rule evaluation denied the seeding operation",
      { reasonCodes: resolved.reasonCodes || [] }
    );
  }

  const mapRaw = resolved.resultsByEntryId || {};
  /** @type {Record<string, object>} */
  const byEntry = {};
  if (mapRaw instanceof Map) {
    for (const [k, v] of mapRaw.entries()) byEntry[String(k)] = v;
  } else {
    Object.assign(byEntry, mapRaw);
  }

  const candidates = args.candidates.map((c) => {
    const row = byEntry[String(c.entryId)];
    if (!row) return c;
    if (row.hardPass === false) {
      return {
        ...c,
        eligibilityStatus: ELIGIBILITY_STATUS.INELIGIBLE,
        eligibilityReasonCodes: [
          ...(c.eligibilityReasonCodes || []),
          ...(row.reasonCodes || ["RULE_DENIED"]),
        ],
      };
    }
    return c;
  });

  return {
    candidates,
    ruleProvenance: deepFreeze({
      ruleSetId: resolved.ruleSetId,
      ruleSetVersion: resolved.ruleSetVersion,
      decisionId: resolved.decisionId || null,
      evaluatedAt: resolved.evaluatedAt || args.effectiveAt,
    }),
  };
}

/**
 * @param {{
 *   scope: object,
 *   entryIds: string[],
 *   snapshotProviderPort?: object|null,
 *   rankingRatingSnapshot?: object|null,
 *   effectiveAt: string|number,
 *   requireSnapshot: boolean,
 *   allowPartialSnapshot: boolean,
 * }} args
 */
export function resolveIntegrationSnapshot(args) {
  let snap = args.rankingRatingSnapshot;
  if (!snap && args.snapshotProviderPort) {
    snap = getSnapshotThroughPort(args.snapshotProviderPort, {
      seedingScope: args.scope,
      entryIds: args.entryIds,
      effectiveAt: args.effectiveAt,
    });
  }
  if (!snap) {
    if (args.requireSnapshot) {
      throwSeedingError(
        SEEDING_ERROR_CODE.SNAPSHOT_REQUIRED,
        "RankingRatingSnapshot is required"
      );
    }
    return null;
  }

  if (!snap.snapshotId || !snap.sourceSystem || !snap.sourceVersion) {
    throwSeedingError(
      SEEDING_ERROR_CODE.SNAPSHOT_REQUIRED,
      "snapshot identity and source provenance are required"
    );
  }
  if (snap.capturedAt == null || snap.effectiveAt == null) {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "snapshot capturedAt and effectiveAt must be supplied"
    );
  }

  if (snap.scopeRef) {
    const snapKey = buildSeedingScopeKey(
      /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ ({
        competitionId: snap.scopeRef.competitionId,
        competitionVersionId: snap.scopeRef.competitionVersionId ?? null,
        divisionId: snap.scopeRef.divisionId ?? null,
        categoryId: snap.scopeRef.categoryId ?? null,
        stageId: snap.scopeRef.stageId ?? null,
        entryType:
          snap.scopeRef.entryType ||
          /** @type {{entryType?:string}} */ (args.scope).entryType,
      })
    );
    const scopeKey = buildSeedingScopeKey(
      /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
        args.scope
      )
    );
    if (snapKey !== scopeKey) {
      throwSeedingError(
        SEEDING_ERROR_CODE.SNAPSHOT_SCOPE_MISMATCH,
        "snapshot scopeRef does not match integration SeedingScope",
        { snapKey, scopeKey }
      );
    }
  }

  const completeness = String(snap.completenessState || "");
  if (completeness === "EMPTY" || completeness === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.SNAPSHOT_INCOMPLETE,
      "snapshot completenessState is insufficient"
    );
  }
  if (completeness === "PARTIAL" && !args.allowPartialSnapshot) {
    throwSeedingError(
      SEEDING_ERROR_CODE.SNAPSHOT_INCOMPLETE,
      "PARTIAL snapshot rejected by integration policy"
    );
  }

  return deepFreezeClone(snap);
}

export { FINALIZATION_STATE };

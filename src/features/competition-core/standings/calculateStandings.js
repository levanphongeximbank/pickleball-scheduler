import {
  CORE18_ENGINE_ID,
  CORE18_ENGINE_VERSION,
  DEFAULT_TIEBREAK_RULE_SET_ID,
  STANDINGS_ENGINE_VERSION,
} from "./standingsConstants.js";
import {
  buildMatchSetHash,
  cloneStandingsRequest,
  createStandingsAudit,
  createStandingsConfiguration,
  createStandingsDecisionTrace,
  createStandingsExplanation,
  createStandingsRequest,
  createStandingsResult,
  createStandingsSnapshot,
} from "./standingsContracts.js";
import { buildDrawLotTokensForEntries } from "./drawLot.js";
import { accumulateStandingsRows } from "./scoringRules.js";
import {
  applyManualOverrides,
  applyQualificationDecisions,
  rankStandingsRows,
} from "./tieBreakSteps.js";
import {
  STANDINGS_ERROR_CODE,
  STANDINGS_WARNING_CODE,
  createStandingsIssue,
} from "./standingsErrors.js";
import {
  adaptValidatedResultsToStandingsMatches,
  compareCanonicalIdentity,
} from "./canonicalResultAdapter.js";

/**
 * Build a deterministic trace id from request material (no Date.now / counters).
 * @param {import('./standingsTypes.js').StandingsRequest} input
 * @param {string} matchSetHash
 */
function buildDeterministicTraceId(input, matchSetHash) {
  const material = [
    input.tournamentId || "",
    input.eventId || "",
    input.groupId || "",
    matchSetHash,
    (input.entries || []).map((entry) => entry.entryId).sort(compareCanonicalIdentity).join(","),
  ].join("::");
  let hash = 2166136261;
  for (let i = 0; i < material.length; i += 1) {
    hash ^= material.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `standings-trace-${(hash >>> 0).toString(16)}`;
}

/**
 * Pure canonical standings calculator — no DB writes, no input mutation.
 *
 * @param {import('./standingsTypes.js').StandingsRequest} request
 * @param {Object} [options]
 * @param {boolean} [options.groupComplete]
 * @param {boolean} [options.applyQualification] — explicit legacy side-path only; default false
 * @param {boolean} [options.requireInjectedTieBreakRules] — when true, reject silent DEFAULT_TIEBREAK_ORDER
 */
export function calculateCanonicalStandings(request, options = {}) {
  const warnings = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {ReturnType<typeof createStandingsIssue>[]} */
  const typedErrors = [];
  /** @type {ReturnType<typeof createStandingsIssue>[]} */
  const typedWarnings = [];
  const explanations = [];

  const rawRules = request?.configuration?.tieBreakRules;
  const rawRuleSetId = request?.configuration?.tieBreakRuleSetId;
  const requireInjected =
    options.requireInjectedTieBreakRules === true ||
    (Array.isArray(request?.matches) &&
      request.matches.some((match) => match?.canonicalSource === true));
  if (
    requireInjected &&
    (!Array.isArray(rawRules) ||
      rawRules.length === 0 ||
      rawRuleSetId === DEFAULT_TIEBREAK_RULE_SET_ID)
  ) {
    const issue = createStandingsIssue(
      STANDINGS_ERROR_CODE.STANDINGS_MISSING_RULE_SET,
      "Canonical standings require an injected tie-break rule set.",
      {
        tieBreakRuleSetId: rawRuleSetId ?? null,
        ruleCount: Array.isArray(rawRules) ? rawRules.length : 0,
      }
    );
    return createStandingsResult({
      ok: false,
      errors: [issue.message],
      warnings,
      typedErrors: [issue],
      typedWarnings,
      decisionTrace: createStandingsDecisionTrace({
        traceId: "standings-trace-missing-rules",
        engineVersion: STANDINGS_ENGINE_VERSION,
      }),
      audit: createStandingsAudit({
        engineVersion: STANDINGS_ENGINE_VERSION,
        warnings,
      }),
      snapshot: createStandingsSnapshot({
        engineVersion: STANDINGS_ENGINE_VERSION,
        warnings,
      }),
      explanations: [
        createStandingsExplanation({
          code: issue.code,
          message: issue.message,
          details: issue.details,
        }),
      ],
    });
  }

  const input = cloneStandingsRequest(request);

  if (!input.entries?.length) {
    const issue = createStandingsIssue(
      STANDINGS_ERROR_CODE.STANDINGS_EMPTY_ENTRY_ROSTER,
      "Standings request requires at least one entry.",
      {}
    );
    typedErrors.push(issue);
    errors.push(issue.message);
    return createStandingsResult({
      ok: false,
      errors,
      warnings,
      typedErrors,
      typedWarnings,
      decisionTrace: createStandingsDecisionTrace({
        traceId: "standings-trace-empty",
        engineVersion: STANDINGS_ENGINE_VERSION,
      }),
      audit: createStandingsAudit({
        engineVersion: STANDINGS_ENGINE_VERSION,
        warnings,
      }),
      snapshot: createStandingsSnapshot({
        engineVersion: STANDINGS_ENGINE_VERSION,
        warnings,
      }),
      explanations: [
        createStandingsExplanation({
          code: issue.code,
          message: issue.message,
          details: issue.details,
        }),
      ],
    });
  }

  if (!input.configuration?.scoringRule) {
    const issue = createStandingsIssue(
      STANDINGS_ERROR_CODE.STANDINGS_MISSING_RULE_SET,
      "Standings request requires a scoring rule.",
      {}
    );
    typedErrors.push(issue);
    errors.push(issue.message);
  }

  if (!Array.isArray(input.configuration?.tieBreakRules) || input.configuration.tieBreakRules.length === 0) {
    const issue = createStandingsIssue(
      STANDINGS_ERROR_CODE.STANDINGS_MISSING_RULE_SET,
      "Standings request requires an injected or default tie-break rule set.",
      {}
    );
    typedErrors.push(issue);
    errors.push(issue.message);
  }

  const traceSink = {
    warnings,
    typedWarnings,
    typedErrors,
    excludedMatches: [],
    tieGroups: [],
    tieBreakSteps: [],
    miniTableCalculations: [],
    headToHeadCalculations: [],
  };

  const {
    rows: initialRows,
    excludedMatches,
    seenMatchIds,
    hasFatalErrors,
  } = accumulateStandingsRows(input, traceSink);

  for (const item of excludedMatches) {
    explanations.push(
      createStandingsExplanation({
        code: item.code || STANDINGS_WARNING_CODE.STANDINGS_RESULT_EXCLUDED,
        message: `Match ${item.matchId} excluded: ${item.reason}.`,
        details: item,
      })
    );
  }

  let rankedRows = rankStandingsRows(initialRows, input, input.matches, traceSink);

  // Qualification / advancement is explicit legacy side-path only — never default-on.
  let qualification = { rows: rankedRows, decisions: [] };
  if (options.applyQualification === true) {
    qualification = applyQualificationDecisions(
      rankedRows,
      input,
      options.groupComplete !== false
    );
    rankedRows = qualification.rows;
    if (qualification.decisions.length) {
      typedWarnings.push(
        createStandingsIssue(
          STANDINGS_WARNING_CODE.STANDINGS_QUALIFICATION_LEGACY,
          "Qualification statuses applied via legacy side-path; not part of CORE-18 canonical ranking.",
          { decisions: qualification.decisions.length }
        )
      );
    }
  }

  rankedRows = applyManualOverrides(rankedRows, input.manualOverrides);

  const matchSetHash = buildMatchSetHash(input.matches);
  const drawLotTokens = buildDrawLotTokensForEntries(
    rankedRows.map((row) => row.entryId),
    input.configuration.drawLotSeed || "cc08-default-seed"
  );

  const tieBreakRuleSetId =
    input.configuration.tieBreakRuleSetId || "injected-tiebreak";
  const tieBreakRuleSetVersion =
    input.configuration.tieBreakRuleSetVersion || "1";

  const decisionTrace = createStandingsDecisionTrace({
    traceId: buildDeterministicTraceId(input, matchSetHash),
    engineVersion: STANDINGS_ENGINE_VERSION,
    scoringRuleId: input.configuration.scoringRule.scoringRuleId,
    scoringRuleVersion: input.configuration.scoringRule.scoringRuleVersion,
    tieBreakRuleSetId,
    tieBreakRuleSetVersion,
    tournamentId: input.tournamentId,
    eventId: input.eventId,
    groupId: input.groupId,
    inputMatchIds: [...seenMatchIds].sort(compareCanonicalIdentity),
    excludedMatches,
    initialRows,
    tieGroups: traceSink.tieGroups,
    tieBreakSteps: traceSink.tieBreakSteps,
    miniTableCalculations: traceSink.miniTableCalculations,
    headToHeadCalculations: traceSink.headToHeadCalculations,
    drawLotSeed: input.configuration.drawLotSeed,
    drawLotTokens,
    finalRanks: rankedRows.map((row) => ({ entryId: row.entryId, rank: row.rank })),
    qualificationDecisions: qualification.decisions,
    warnings,
  });

  rankedRows.forEach((row) => {
    explanations.push(
      createStandingsExplanation({
        code: "rank_assigned",
        message: `${row.name || row.entryId} ranked #${row.rank} with ${row.points} points.`,
        details: {
          entryId: row.entryId,
          rank: row.rank,
          points: row.points,
          manualOverrideApplied: row.manualOverrideApplied === true,
        },
      })
    );
  });

  for (const issue of typedErrors) {
    errors.push(issue.message);
    explanations.push(
      createStandingsExplanation({
        code: issue.code,
        message: issue.message,
        details: issue.details,
      })
    );
  }

  for (const issue of typedWarnings) {
    explanations.push(
      createStandingsExplanation({
        code: issue.code,
        message: issue.message,
        details: issue.details,
      })
    );
  }

  const snapshot = createStandingsSnapshot({
    tournamentId: input.tournamentId,
    eventId: input.eventId,
    groupId: input.groupId,
    scoringRuleVersion: input.configuration.scoringRule.scoringRuleVersion,
    tieBreakRuleVersion: tieBreakRuleSetVersion,
    matchSetHash,
    rows: rankedRows,
    engineVersion: STANDINGS_ENGINE_VERSION,
    warnings,
  });

  const audit = createStandingsAudit({
    engineVersion: STANDINGS_ENGINE_VERSION,
    scoringRuleId: input.configuration.scoringRule.scoringRuleId,
    scoringRuleVersion: input.configuration.scoringRule.scoringRuleVersion,
    tieBreakRuleSetId,
    tieBreakRuleSetVersion,
    warnings,
  });

  const ok = errors.length === 0 && !hasFatalErrors && typedErrors.length === 0;

  return createStandingsResult({
    ok,
    rows: rankedRows,
    snapshot,
    decisionTrace,
    audit,
    explanations,
    warnings,
    errors,
    typedErrors,
    typedWarnings,
    legacyQualification: qualification.decisions.length
      ? {
          applied: true,
          decisions: qualification.decisions,
          note: "Legacy qualification side-path; not CORE-18 canonical ranking.",
        }
      : undefined,
  });
}

/**
 * Calculate standings from CORE-17 validated results via the canonical adapter.
 *
 * @param {object} params
 * @param {import('./standingsTypes.js').StandingsEntry[]} params.entries
 * @param {object[]} params.validatedResults
 * @param {import('./standingsTypes.js').StandingsConfiguration|object} [params.configuration]
 * @param {object} [params.requestPartial]
 * @param {object} [options]
 */
export function calculateStandingsFromValidatedResults(params, options = {}) {
  const entries = params.entries || [];
  const rawConfiguration = params.configuration || {};
  const injectedRules = rawConfiguration.tieBreakRules;

  // Canonical CORE-17 path: never silently adopt DEFAULT_TIEBREAK_ORDER.
  if (!Array.isArray(injectedRules) || injectedRules.length === 0) {
    const issue = createStandingsIssue(
      STANDINGS_ERROR_CODE.STANDINGS_MISSING_RULE_SET,
      "Canonical standings from validated results require an injected tie-break rule set.",
      {}
    );
    return createStandingsResult({
      ok: false,
      errors: [issue.message],
      typedErrors: [issue],
      explanations: [
        createStandingsExplanation({
          code: issue.code,
          message: issue.message,
          details: issue.details,
        }),
      ],
      decisionTrace: createStandingsDecisionTrace({
        traceId: "standings-trace-missing-rules",
        engineVersion: STANDINGS_ENGINE_VERSION,
      }),
      audit: createStandingsAudit({
        engineVersion: STANDINGS_ENGINE_VERSION,
      }),
      snapshot: createStandingsSnapshot({
        engineVersion: STANDINGS_ENGINE_VERSION,
      }),
    });
  }

  const adapted = adaptValidatedResultsToStandingsMatches(params.validatedResults || [], {
    entryRoster: entries.map((entry) => entry.entryId),
  });

  const request = createStandingsRequest({
    ...(params.requestPartial || {}),
    entries,
    matches: adapted.matches,
    configuration: createStandingsConfiguration(rawConfiguration),
  });

  // Canonical validated-result mode never auto-applies qualification.
  const result = calculateCanonicalStandings(request, {
    ...options,
    requireInjectedTieBreakRules: true,
    applyQualification: options.applyQualification === true,
  });
  const typedErrors = [...(result.typedErrors || []), ...adapted.errors];
  const typedWarnings = [...(result.typedWarnings || []), ...adapted.warnings];
  const explanations = [...adapted.explanations, ...(result.explanations || [])];

  return createStandingsResult({
    ...result,
    ok: result.ok && adapted.ok && typedErrors.length === 0,
    typedErrors,
    typedWarnings,
    explanations,
    errors: [
      ...(result.errors || []),
      ...adapted.errors.map((issue) => issue.message),
    ],
    warnings: [
      ...(result.warnings || []),
      ...adapted.warnings.map((issue) => issue.message),
    ],
    decisionTrace: {
      ...result.decisionTrace,
      excludedMatches: [
        ...(result.decisionTrace?.excludedMatches || []),
        ...adapted.excluded,
      ],
    },
  });
}

/**
 * @param {import('./standingsTypes.js').StandingsRequest} request
 */
export function validateStandingsRequestShape(request) {
  const errors = [];
  const typedErrors = [];
  if (!request || typeof request !== "object") {
    const issue = createStandingsIssue(
      STANDINGS_ERROR_CODE.STANDINGS_INVALID_REQUEST,
      "request object required",
      {}
    );
    errors.push(issue.message);
    typedErrors.push(issue);
  }
  if (!Array.isArray(request?.entries) || request.entries.length === 0) {
    const issue = createStandingsIssue(
      STANDINGS_ERROR_CODE.STANDINGS_EMPTY_ENTRY_ROSTER,
      "entries required",
      {}
    );
    errors.push(issue.message);
    typedErrors.push(issue);
  }
  if (!request?.configuration?.scoringRule) {
    const issue = createStandingsIssue(
      STANDINGS_ERROR_CODE.STANDINGS_MISSING_RULE_SET,
      "scoringRule required",
      {}
    );
    errors.push(issue.message);
    typedErrors.push(issue);
  }
  return { ok: errors.length === 0, errors, typedErrors };
}

/**
 * @param {import('./standingsTypes.js').StandingsResult} result
 */
export function isStandingsResultJsonSerializable(result) {
  try {
    JSON.stringify(result);
    return true;
  } catch {
    return false;
  }
}

export const CORE18_IDENTITY = Object.freeze({
  engineId: CORE18_ENGINE_ID,
  engineVersion: CORE18_ENGINE_VERSION,
  standingsEngineVersion: STANDINGS_ENGINE_VERSION,
});

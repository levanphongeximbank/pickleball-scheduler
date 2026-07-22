/**
 * CORE-11 Phase 1G-B1 — MatchPlan → ScheduleRequest adapter (pure).
 *
 * Consumes only the public CORE-09 barrel. Does not mutate MatchPlan or policy.
 * Does not invoke Phase 1E repair or Phase 1F certification as validation cover.
 * Does not import CORE-10, CC-09, persistence, or UI.
 */

import {
  MATCH_DEPENDENCY_TYPE,
  MATCH_GENERATOR_IDENTITY,
  MATCH_GENERATION_SCHEMA_VERSION,
  PARTICIPANT_SLOT_KIND,
  assertMatchPlanValid,
  fingerprintMatchPlan,
  isMatchGenerationStrategy,
} from "../../match-generation/index.js";

import {
  PARTICIPANT_REFERENCE_KIND,
  SCHEDULE_DEPENDENCY_TYPE,
  SCHEDULE_DIAGNOSTIC_SEVERITY,
  isParticipantReferenceKind,
} from "../scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
} from "../scheduleDiagnostics.js";
import {
  createMatchPlanToScheduleRequestResult,
  createScheduleDependency,
  createScheduleMatchInput,
  createScheduleParticipantReference,
  createSchedulePolicy,
  createScheduleRequest,
  fingerprintScheduleRequest,
} from "../scheduleContracts.js";
import { validateScheduleRequest } from "../validateScheduleRequest.js";
import {
  asciiCompare,
  isNonNegativeInteger,
  isPositiveInteger,
  isValidIdentifier,
  isValidIanaTimezone,
  normalizeIdentifier,
  stableSortByKeys,
} from "../scheduleTypes.js";

/**
 * @param {unknown} matchPlan
 * @param {unknown} schedulePolicyBundle
 * @returns {import('../scheduleTypes.js').MatchPlanToScheduleRequestResult}
 */
export function createScheduleRequestFromMatchPlan(
  matchPlan,
  schedulePolicyBundle
) {
  /** @type {import('../scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  const emptySummary = () => ({
    sourceMatchCount: 0,
    mappedMatchCount: 0,
    byeMatchCount: 0,
    dependencyCount: 0,
    concreteParticipantCount: 0,
    placeholderParticipantCount: 0,
  });

  const fail = (replay = {}, summary = emptySummary()) =>
    createMatchPlanToScheduleRequestResult({
      ok: false,
      scheduleRequest: null,
      diagnostics,
      mappingSummary: summary,
      replay,
    });

  // --- 1. CORE-09 MatchPlan validation (public) ---
  if (matchPlan == null || typeof matchPlan !== "object" || Array.isArray(matchPlan)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID,
      message: "MatchPlan must be a plain object",
    });
    return fail();
  }

  const planRecord = /** @type {Record<string, unknown>} */ (matchPlan);
  const planMeta =
    planRecord.metadata && typeof planRecord.metadata === "object"
      ? /** @type {Record<string, unknown>} */ (planRecord.metadata)
      : {};
  const phase1c =
    planMeta.phase1c && typeof planMeta.phase1c === "object"
      ? /** @type {Record<string, unknown>} */ (planMeta.phase1c)
      : {};

  // Optional strategy for public fingerprintMatchPlan / assertMatchPlanValid.
  // Never treat strategy (or raw metadata) as the replay fingerprint itself.
  const strategyCandidate = normalizeIdentifier(
    phase1c.strategy || planMeta.strategy || ""
  );
  /** @type {string|undefined} */
  let strategyForPublicApi;
  if (strategyCandidate) {
    if (!isMatchGenerationStrategy(strategyCandidate)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID,
        path: "metadata.phase1c.strategy",
        message:
          "MatchPlan strategy is not a public CORE-09 MatchGenerationStrategy",
        details: { strategy: strategyCandidate },
      });
      return fail();
    }
    strategyForPublicApi = strategyCandidate;
  }
  const fingerprintExtras = strategyForPublicApi
    ? { strategy: strategyForPublicApi }
    : {};

  let computedFingerprint = "";
  try {
    computedFingerprint = fingerprintMatchPlan(matchPlan, fingerprintExtras);
  } catch (err) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID,
      path: "generationFingerprint",
      message: "public fingerprintMatchPlan failed",
      details: {
        reason: String(
          err && typeof err === "object" && "message" in err
            ? /** @type {{ message?: unknown }} */ (err).message
            : err
        ),
      },
    });
    return fail();
  }

  const existingFingerprint = String(
    planRecord.generationFingerprint || ""
  ).trim();
  /** Prefer existing canonical fingerprint only when it matches public recompute. */
  let matchPlanFingerprint = computedFingerprint;
  if (existingFingerprint) {
    if (existingFingerprint === computedFingerprint) {
      matchPlanFingerprint = existingFingerprint;
    } else {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID,
        path: "generationFingerprint",
        message:
          "MatchPlan generationFingerprint does not match public fingerprintMatchPlan",
        details: {
          upstreamCode: "GENERATION_FINGERPRINT_MISMATCH",
          expected: computedFingerprint,
          actual: existingFingerprint,
        },
      });
      return fail({
        sourceEngineId: MATCH_GENERATOR_IDENTITY.id,
        sourceEngineVersion: String(
          planRecord.generatorVersion || MATCH_GENERATOR_IDENTITY.version
        ),
        sourceSchemaVersion: String(
          planRecord.schemaVersion || MATCH_GENERATION_SCHEMA_VERSION
        ),
        matchPlanFingerprint: computedFingerprint,
      });
    }
  }

  const planAssert = assertMatchPlanValid(matchPlan, {
    ...fingerprintExtras,
    // Adapter already verified existing fingerprint against public recompute.
    requireGenerationFingerprintMatch: false,
  });
  if (!planAssert.ok) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID,
      message: "MatchPlan failed public CORE-09 invariant validation",
      details: {
        issueCount: planAssert.issues.length,
        issueCodes: [
          ...new Set(planAssert.issues.map((i) => String(i.code || ""))),
        ].sort(asciiCompare),
      },
    });
    for (const issue of planAssert.issues) {
      diagnostics.push(
        createScheduleDiagnostic({
          code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID,
          severity:
            issue.severity === "WARNING"
              ? SCHEDULE_DIAGNOSTIC_SEVERITY.WARNING
              : SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR,
          path: issue.path || "",
          message: issue.message || "MatchPlan invariant issue",
          relatedMatchIds: Array.isArray(issue.relatedLogicalMatchKeys)
            ? issue.relatedLogicalMatchKeys.map((k) => normalizeIdentifier(k))
            : [],
          details: {
            upstreamCode: issue.code || null,
            upstream: true,
          },
        })
      );
    }
  }

  const replayBase = {
    sourceEngineId: MATCH_GENERATOR_IDENTITY.id,
    sourceEngineVersion: String(
      planRecord.generatorVersion || MATCH_GENERATOR_IDENTITY.version
    ),
    sourceSchemaVersion: String(
      planRecord.schemaVersion || MATCH_GENERATION_SCHEMA_VERSION
    ),
    matchPlanFingerprint,
  };

  if (!planAssert.ok) {
    return fail(replayBase);
  }

  const plan = planRecord;
  const competitionId = normalizeIdentifier(plan.competitionId);
  if (!isValidIdentifier(competitionId)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_FIELD_MISSING,
      path: "competitionId",
      message: "MatchPlan.competitionId is required",
    });
    return fail(replayBase);
  }

  // --- 2. Policy bundle validation ---
  const policyResult = validatePolicyBundle(schedulePolicyBundle, push);
  if (!policyResult.ok) {
    return fail(replayBase);
  }
  const bundle = policyResult.bundle;

  if (
    bundle.competitionId &&
    bundle.competitionId !== competitionId
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_FIELD_MISSING,
      path: "schedulePolicyBundle.competitionId",
      message: "external competitionId does not match MatchPlan.competitionId",
      details: {
        matchPlanCompetitionId: competitionId,
        bundleCompetitionId: bundle.competitionId,
      },
    });
    return fail(replayBase);
  }

  const logicalMatches = Array.isArray(plan.logicalMatches)
    ? /** @type {any[]} */ (plan.logicalMatches)
    : [];
  const sourceMatchCount = logicalMatches.length;
  const nonByeCount = logicalMatches.filter((m) => m && m.isByeMatch !== true)
    .length;

  if (nonByeCount > 0 && bundle.operatingWindows.length === 0) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path: "operatingWindows",
      message:
        "operatingWindows must be explicit and non-empty for a runnable MatchPlan",
    });
    return fail(replayBase, { ...emptySummary(), sourceMatchCount });
  }

  /** @type {Map<string, any>} */
  const byKey = new Map();
  for (const m of logicalMatches) {
    const key = normalizeIdentifier(m?.logicalMatchKey);
    if (!isValidIdentifier(key)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_FIELD_MISSING,
        path: "logicalMatches.logicalMatchKey",
        message: "logicalMatchKey must be a non-empty trimmed string",
      });
      continue;
    }
    if (byKey.has(key)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID,
        path: `logicalMatches[logicalMatchKey=${key}]`,
        message: `duplicate logicalMatchKey: ${key}`,
        relatedMatchIds: [key],
      });
      continue;
    }
    byKey.set(key, m);
  }

  if (diagnostics.some((d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR)) {
    return fail(replayBase, { ...emptySummary(), sourceMatchCount });
  }

  // Outgoing consistency index: sourceKey -> [{ type, targetKey }]
  /** @type {Map<string, Array<{ type: string, targetKey: string }>>} */
  const outgoing = new Map();
  for (const [key, m] of byKey) {
    for (const edge of [
      { field: "winnerTo", type: MATCH_DEPENDENCY_TYPE.WINNER_OF },
      { field: "loserTo", type: MATCH_DEPENDENCY_TYPE.LOSER_OF },
    ]) {
      const ptr = m[edge.field];
      if (!ptr) continue;
      const type = normalizeIdentifier(ptr.type) || edge.type;
      const target = normalizeIdentifier(ptr.logicalMatchKey);
      if (!target) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_DEPENDENCY_INCONSISTENT,
          path: `logicalMatches[logicalMatchKey=${key}].${edge.field}`,
          message: `${edge.field} missing logicalMatchKey`,
          relatedMatchIds: [key],
        });
        continue;
      }
      let list = outgoing.get(key);
      if (!list) {
        list = [];
        outgoing.set(key, list);
      }
      list.push({ type, targetKey: target });
    }
  }

  /** @type {any[]} */
  const mappedMatches = [];
  let byeMatchCount = 0;
  let dependencyCount = 0;
  let concreteParticipantCount = 0;
  let placeholderParticipantCount = 0;

  const orderedKeys = [...byKey.keys()].sort(asciiCompare);

  for (const matchKey of orderedKeys) {
    const m = byKey.get(matchKey);
    const path = `logicalMatches[logicalMatchKey=${matchKey}]`;
    const isBye = m.isByeMatch === true;

    const slotA = m.participantSlotA;
    const slotB = m.participantSlotB;
    const slotByeA = isByeSlot(slotA);
    const slotByeB = isByeSlot(slotB);
    if (isBye !== (slotByeA || slotByeB) && !(isBye && slotByeA && slotByeB)) {
      // Allow isByeMatch true with one bye slot; fail if flags contradict.
      if (isBye && !slotByeA && !slotByeB) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID,
          path,
          message: "isByeMatch true but neither participant slot is BYE",
          relatedMatchIds: [matchKey],
        });
        continue;
      }
      if (!isBye && (slotByeA || slotByeB)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_INVALID,
          path,
          message: "bye slot present but isByeMatch is false",
          relatedMatchIds: [matchKey],
        });
        continue;
      }
    }

    if (isBye) byeMatchCount += 1;

    /** @type {any[]} */
    const participants = [];
    const slotResults = [
      mapParticipantSlot(slotA, matchKey, `${path}.participantSlotA`, bundle, byKey, push),
      mapParticipantSlot(slotB, matchKey, `${path}.participantSlotB`, bundle, byKey, push),
    ];
    for (const sr of slotResults) {
      if (!sr) continue;
      if (sr.participant) {
        participants.push(sr.participant);
        if (sr.kind === "PLACEHOLDER") placeholderParticipantCount += 1;
        else if (sr.kind === "CONCRETE") concreteParticipantCount += 1;
      }
      if (sr.dependency) {
        // collected below via normalizeIncomingDependencies
      }
    }

    const depResult = normalizeIncomingDependencies({
      match: m,
      matchKey,
      path,
      byKey,
      outgoing,
      slotDeps: slotResults
        .map((s) => s && s.dependency)
        .filter(Boolean),
      push,
    });
    if (!depResult.ok) continue;

    const dependencies = depResult.dependencies;
    dependencyCount += dependencies.length;

    /** @type {Record<string, unknown>} */
    const matchPartial = {
      matchId: matchKey,
      participants: stableSortByKeys(participants, (p) => [
        p.kind || "",
        p.participantId,
      ]),
      dependencies,
      isBye,
    };

    const divisionId = normalizeIdentifier(m.divisionId);
    if (divisionId) matchPartial.divisionId = divisionId;
    const stageId = normalizeIdentifier(m.stageId);
    if (stageId) matchPartial.stageId = stageId;
    if (typeof m.roundNumber === "number" && Number.isInteger(m.roundNumber)) {
      matchPartial.roundNumber = m.roundNumber;
    }

    if (
      typeof m.deterministicOrder === "number" &&
      Number.isInteger(m.deterministicOrder)
    ) {
      matchPartial.sequence = m.deterministicOrder;
    } else if (
      typeof m.matchNumber === "number" &&
      Number.isInteger(m.matchNumber)
    ) {
      matchPartial.sequence = m.matchNumber;
    }

    const priority = bundle.priorityByMatchId.get(matchKey);
    if (priority !== undefined) {
      if (!Number.isInteger(priority)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
          path: `priorityByMatchId[${matchKey}]`,
          message: "priorityByMatchId values must be integers",
          relatedMatchIds: [matchKey],
        });
      } else {
        matchPartial.priority = priority;
      }
    }

    const est = bundle.estimatedDurationByMatchId.get(matchKey);
    if (est !== undefined) {
      if (!isPositiveInteger(est)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
          path: `estimatedDurationByMatchId[${matchKey}]`,
          message: "estimatedDurationByMatchId values must be positive integers",
          relatedMatchIds: [matchKey],
        });
      } else {
        matchPartial.estimatedDurationMinutes = est;
      }
    }

    mappedMatches.push(createScheduleMatchInput(matchPartial));
  }

  if (diagnostics.some((d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR)) {
    return fail(replayBase, {
      sourceMatchCount,
      mappedMatchCount: 0,
      byeMatchCount,
      dependencyCount: 0,
      concreteParticipantCount,
      placeholderParticipantCount,
    });
  }

  const scheduleRequest = createScheduleRequest({
    competitionId,
    timezone: bundle.timezone,
    matches: stableSortByKeys(mappedMatches, (m) => [
      m.sequence ?? Number.MAX_SAFE_INTEGER,
      m.matchId,
    ]),
    policy: createSchedulePolicy({
      duration: {
        defaultDurationMinutes: bundle.defaultDurationMinutes,
        bufferMinutes: bundle.bufferMinutes,
        durationByStage: bundle.durationByStage,
        durationByRound: bundle.durationByRound,
      },
      rest: {
        minParticipantRestMinutes: bundle.minParticipantRestMinutes,
        minTeamRestMinutes: bundle.minTeamRestMinutes,
      },
      capacity: {
        maxConcurrentMatches: bundle.maxConcurrentMatches,
      },
    }),
    operatingWindows: bundle.operatingWindows,
    sessionWindows: bundle.sessionWindows,
  });

  // --- 7. CORE-11 request validation ---
  const validated = validateScheduleRequest(scheduleRequest);
  diagnostics.push(...validated.diagnostics);

  const summary = {
    sourceMatchCount,
    mappedMatchCount: mappedMatches.length,
    byeMatchCount,
    dependencyCount,
    concreteParticipantCount,
    placeholderParticipantCount,
  };

  const hasError = diagnostics.some(
    (d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR
  );
  if (hasError || !validated.ok || !validated.request) {
    return fail(
      {
        ...replayBase,
      },
      summary
    );
  }

  let requestFingerprint = "";
  try {
    requestFingerprint = fingerprintScheduleRequest(validated.request);
  } catch {
    requestFingerprint = "";
  }

  return createMatchPlanToScheduleRequestResult({
    ok: true,
    scheduleRequest: validated.request,
    diagnostics,
    mappingSummary: summary,
    replay: {
      ...replayBase,
      scheduleRequestFingerprint: requestFingerprint,
    },
  });
}

/**
 * @param {unknown} bundle
 * @param {(partial: object) => void} push
 */
function validatePolicyBundle(bundle, push) {
  if (bundle == null || typeof bundle !== "object" || Array.isArray(bundle)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      message: "schedulePolicyBundle must be a plain object",
    });
    return { ok: false, bundle: null };
  }
  const b = /** @type {Record<string, unknown>} */ (bundle);
  const timezone = normalizeIdentifier(b.timezone);
  if (!timezone || !isValidIanaTimezone(timezone)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path: "timezone",
      message: "timezone must be an explicit valid IANA id",
    });
  }
  if (!Array.isArray(b.operatingWindows)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path: "operatingWindows",
      message: "operatingWindows must be an explicit array",
    });
  }
  if (b.sessionWindows !== undefined && !Array.isArray(b.sessionWindows)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path: "sessionWindows",
      message: "sessionWindows must be an array when provided",
    });
  }
  if (!isPositiveInteger(b.defaultDurationMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path: "defaultDurationMinutes",
      message: "defaultDurationMinutes must be an explicit positive integer",
    });
  }
  if (!isNonNegativeInteger(b.bufferMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path: "bufferMinutes",
      message: "bufferMinutes must be an explicit non-negative integer",
    });
  }
  if (!isNonNegativeInteger(b.dependencyBufferMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path: "dependencyBufferMinutes",
      message: "dependencyBufferMinutes must be an explicit non-negative integer",
    });
  }
  if (
    isNonNegativeInteger(b.bufferMinutes) &&
    isNonNegativeInteger(b.dependencyBufferMinutes) &&
    Number(b.bufferMinutes) !== Number(b.dependencyBufferMinutes)
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_BUFFER_CONFLICT,
      path: "dependencyBufferMinutes",
      message:
        "CORE-11 shared-buffer contract: dependencyBufferMinutes must equal bufferMinutes; divergent capacity vs dependency buffers are not representable",
      details: {
        capacityBufferMinutes: b.bufferMinutes,
        dependencyBufferMinutes: b.dependencyBufferMinutes,
        canonicalField: "policy.duration.bufferMinutes",
      },
    });
  }
  if (!isNonNegativeInteger(b.minParticipantRestMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path: "minParticipantRestMinutes",
      message: "minParticipantRestMinutes must be an explicit non-negative integer",
    });
  }
  if (
    b.minTeamRestMinutes !== undefined &&
    b.minTeamRestMinutes !== null &&
    !isNonNegativeInteger(b.minTeamRestMinutes)
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path: "minTeamRestMinutes",
      message: "minTeamRestMinutes must be a non-negative integer when provided",
    });
  }
  if (!isPositiveInteger(b.maxConcurrentMatches)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path: "maxConcurrentMatches",
      message: "maxConcurrentMatches must be an explicit positive integer",
    });
  }

  const defaultKind = normalizeIdentifier(b.defaultDirectParticipantKind);
  if (
    defaultKind &&
    defaultKind !== PARTICIPANT_REFERENCE_KIND.PLAYER &&
    defaultKind !== PARTICIPANT_REFERENCE_KIND.TEAM &&
    defaultKind !== PARTICIPANT_REFERENCE_KIND.ENTRY
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.IDENTITY_ENRICHMENT_INVALID,
      path: "defaultDirectParticipantKind",
      message: "defaultDirectParticipantKind must be PLAYER, TEAM, or ENTRY",
    });
  }

  const identityByParticipantId = normalizeIdentityMap(
    b.identityByParticipantId,
    "identityByParticipantId",
    push
  );
  const placementIdentityByRef = normalizePlacementMap(
    b.placementIdentityByRef,
    "placementIdentityByRef",
    push
  );

  const estimatedDurationByMatchId = normalizeNumberMap(
    b.estimatedDurationByMatchId,
    "estimatedDurationByMatchId",
    push
  );
  const priorityByMatchId = normalizeNumberMap(
    b.priorityByMatchId,
    "priorityByMatchId",
    push
  );

  const durationByStage =
    b.durationByStage && typeof b.durationByStage === "object"
      ? /** @type {Record<string, number>} */ ({ ...b.durationByStage })
      : undefined;
  const durationByRound =
    b.durationByRound && typeof b.durationByRound === "object"
      ? /** @type {Record<string, number>} */ ({ ...b.durationByRound })
      : undefined;

  const policyOk =
    !!timezone &&
    isValidIanaTimezone(timezone) &&
    Array.isArray(b.operatingWindows) &&
    (b.sessionWindows === undefined || Array.isArray(b.sessionWindows)) &&
    isPositiveInteger(b.defaultDurationMinutes) &&
    isNonNegativeInteger(b.bufferMinutes) &&
    isNonNegativeInteger(b.dependencyBufferMinutes) &&
    Number(b.bufferMinutes) === Number(b.dependencyBufferMinutes) &&
    isNonNegativeInteger(b.minParticipantRestMinutes) &&
    (b.minTeamRestMinutes === undefined ||
      b.minTeamRestMinutes === null ||
      isNonNegativeInteger(b.minTeamRestMinutes)) &&
    isPositiveInteger(b.maxConcurrentMatches) &&
    (!defaultKind ||
      defaultKind === PARTICIPANT_REFERENCE_KIND.PLAYER ||
      defaultKind === PARTICIPANT_REFERENCE_KIND.TEAM ||
      defaultKind === PARTICIPANT_REFERENCE_KIND.ENTRY) &&
    identityByParticipantId.ok &&
    placementIdentityByRef.ok &&
    estimatedDurationByMatchId.ok &&
    priorityByMatchId.ok;

  if (!policyOk) {
    return { ok: false, bundle: null };
  }

  return {
    ok: true,
    bundle: {
      timezone,
      competitionId: normalizeIdentifier(b.competitionId) || "",
      operatingWindows: /** @type {unknown[]} */ (b.operatingWindows),
      sessionWindows: Array.isArray(b.sessionWindows) ? b.sessionWindows : [],
      defaultDurationMinutes: Number(b.defaultDurationMinutes),
      // Outcome B: one shared canonical buffer after equality check.
      bufferMinutes: Number(b.bufferMinutes),
      minParticipantRestMinutes: Number(b.minParticipantRestMinutes),
      minTeamRestMinutes:
        b.minTeamRestMinutes === undefined || b.minTeamRestMinutes === null
          ? 0
          : Number(b.minTeamRestMinutes),
      maxConcurrentMatches: Number(b.maxConcurrentMatches),
      durationByStage,
      durationByRound,
      defaultDirectParticipantKind: defaultKind || "",
      identityByParticipantId: identityByParticipantId.map,
      placementIdentityByRef: placementIdentityByRef.map,
      estimatedDurationByMatchId: estimatedDurationByMatchId.map,
      priorityByMatchId: priorityByMatchId.map,
    },
  };
}

function normalizeIdentityMap(raw, path, push) {
  /** @type {Map<string, { kind: string, teamId?: string, constraintResourceIds?: string[] }>} */
  const map = new Map();
  if (raw == null) return { ok: true, map };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.IDENTITY_ENRICHMENT_INVALID,
      path,
      message: `${path} must be a plain object map`,
    });
    return { ok: false, map };
  }
  let ok = true;
  for (const key of Object.keys(/** @type {object} */ (raw)).sort(asciiCompare)) {
    const id = normalizeIdentifier(key);
    const val = /** @type {any} */ (raw)[key];
    if (!isValidIdentifier(id) || val == null || typeof val !== "object") {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.IDENTITY_ENRICHMENT_INVALID,
        path: `${path}[${key}]`,
        message: "identity enrichment entry must be an object keyed by participantId",
      });
      ok = false;
      continue;
    }
    const kind = normalizeIdentifier(val.kind);
    if (
      kind &&
      kind !== PARTICIPANT_REFERENCE_KIND.PLAYER &&
      kind !== PARTICIPANT_REFERENCE_KIND.TEAM &&
      kind !== PARTICIPANT_REFERENCE_KIND.ENTRY
    ) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.IDENTITY_ENRICHMENT_INVALID,
        path: `${path}[${id}].kind`,
        message: "enrichment kind must be PLAYER, TEAM, or ENTRY",
      });
      ok = false;
      continue;
    }
    const resources = normalizeResourceIds(val.constraintResourceIds, `${path}[${id}]`, push);
    if (!resources.ok) {
      ok = false;
      continue;
    }
    const entry = {
      kind: kind || "",
      teamId: normalizeIdentifier(val.teamId) || undefined,
      constraintResourceIds: resources.ids,
    };
    if (map.has(id)) {
      const prev = map.get(id);
      if (
        prev.kind !== entry.kind ||
        (prev.teamId || "") !== (entry.teamId || "") ||
        JSON.stringify(prev.constraintResourceIds || []) !==
          JSON.stringify(entry.constraintResourceIds || [])
      ) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.IDENTITY_ENRICHMENT_INVALID,
          path: `${path}[${id}]`,
          message: "conflicting identity enrichment for the same participantId",
        });
        ok = false;
      }
      continue;
    }
    map.set(id, entry);
  }
  return { ok, map };
}

function normalizePlacementMap(raw, path, push) {
  /** @type {Map<string, { participantId: string, kind?: string, teamId?: string, constraintResourceIds?: string[] }>} */
  const map = new Map();
  if (raw == null) return { ok: true, map };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.IDENTITY_ENRICHMENT_INVALID,
      path,
      message: `${path} must be a plain object map`,
    });
    return { ok: false, map };
  }
  let ok = true;
  for (const key of Object.keys(/** @type {object} */ (raw)).sort(asciiCompare)) {
    const ref = normalizeIdentifier(key);
    const val = /** @type {any} */ (raw)[key];
    if (!isValidIdentifier(ref) || val == null || typeof val !== "object") {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.IDENTITY_ENRICHMENT_INVALID,
        path: `${path}[${key}]`,
        message: "placement enrichment entry must be an object",
      });
      ok = false;
      continue;
    }
    const participantId = normalizeIdentifier(val.participantId);
    if (!isValidIdentifier(participantId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.PLACEMENT_IDENTITY_MISSING,
        path: `${path}[${ref}].participantId`,
        message: "placement enrichment requires participantId",
      });
      ok = false;
      continue;
    }
    const kind = normalizeIdentifier(val.kind);
    if (
      kind &&
      kind !== PARTICIPANT_REFERENCE_KIND.PLAYER &&
      kind !== PARTICIPANT_REFERENCE_KIND.TEAM &&
      kind !== PARTICIPANT_REFERENCE_KIND.ENTRY
    ) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.IDENTITY_ENRICHMENT_INVALID,
        path: `${path}[${ref}].kind`,
        message: "placement enrichment kind must be PLAYER, TEAM, or ENTRY",
      });
      ok = false;
      continue;
    }
    const resources = normalizeResourceIds(
      val.constraintResourceIds,
      `${path}[${ref}]`,
      push
    );
    if (!resources.ok) {
      ok = false;
      continue;
    }
    map.set(ref, {
      participantId,
      kind: kind || undefined,
      teamId: normalizeIdentifier(val.teamId) || undefined,
      constraintResourceIds: resources.ids,
    });
  }
  return { ok, map };
}

function normalizeNumberMap(raw, path, push) {
  /** @type {Map<string, number>} */
  const map = new Map();
  if (raw == null) return { ok: true, map };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
      path,
      message: `${path} must be a plain object map`,
    });
    return { ok: false, map };
  }
  for (const key of Object.keys(/** @type {object} */ (raw)).sort(asciiCompare)) {
    const id = normalizeIdentifier(key);
    const value = /** @type {any} */ (raw)[key];
    if (!isValidIdentifier(id) || typeof value !== "number" || !Number.isFinite(value)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_POLICY_MISSING,
        path: `${path}[${key}]`,
        message: `${path} values must be finite numbers keyed by match id`,
      });
      return { ok: false, map };
    }
    map.set(id, value);
  }
  return { ok: true, map };
}

function normalizeResourceIds(raw, path, push) {
  if (raw == null) return { ok: true, ids: undefined };
  if (!Array.isArray(raw)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.IDENTITY_ENRICHMENT_INVALID,
      path: `${path}.constraintResourceIds`,
      message: "constraintResourceIds must be an array when provided",
    });
    return { ok: false, ids: undefined };
  }
  const ids = [
    ...new Set(
      raw.map((id) => normalizeIdentifier(id)).filter((id) => id.length > 0)
    ),
  ].sort(asciiCompare);
  return { ok: true, ids: ids.length > 0 ? ids : undefined };
}

function isByeSlot(slot) {
  if (!slot || typeof slot !== "object") return false;
  return (
    slot.isBye === true ||
    normalizeIdentifier(slot.kind) === PARTICIPANT_SLOT_KIND.BYE
  );
}

/**
 * @returns {{ participant?: object, dependency?: object, kind?: string }|null}
 */
function mapParticipantSlot(slot, matchKey, path, bundle, byKey, push) {
  if (!slot || typeof slot !== "object") {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_FIELD_MISSING,
      path,
      message: "participant slot is required",
      relatedMatchIds: [matchKey],
    });
    return null;
  }
  const kind = normalizeIdentifier(slot.kind);
  if (kind === PARTICIPANT_SLOT_KIND.BYE || slot.isBye === true) {
    return { kind: "BYE" };
  }

  if (kind === PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT) {
    const participantId = normalizeIdentifier(slot.participantId);
    if (!isValidIdentifier(participantId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_PARTICIPANT_IDENTITY_MISSING,
        path: `${path}.participantId`,
        message: "DIRECT_PARTICIPANT requires a stable participantId",
        relatedMatchIds: [matchKey],
      });
      return null;
    }
    const enrichment = bundle.identityByParticipantId.get(participantId) || {};
    const resolvedKind =
      enrichment.kind || bundle.defaultDirectParticipantKind || "";
    if (!resolvedKind || !isParticipantReferenceKind(resolvedKind)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_PARTICIPANT_IDENTITY_MISSING,
        path: `${path}.kind`,
        message:
          "direct participant kind requires identityByParticipantId or defaultDirectParticipantKind",
        relatedMatchIds: [matchKey],
        details: { participantId },
      });
      return null;
    }
    /** @type {Record<string, unknown>} */
    const partial = {
      participantId,
      kind: resolvedKind,
    };
    if (enrichment.teamId) partial.teamId = enrichment.teamId;
    if (enrichment.constraintResourceIds) {
      partial.constraintResourceIds = enrichment.constraintResourceIds;
    }
    return {
      participant: createScheduleParticipantReference(partial),
      kind: "CONCRETE",
    };
  }

  if (
    kind === PARTICIPANT_SLOT_KIND.WINNER_OF ||
    kind === PARTICIPANT_SLOT_KIND.LOSER_OF
  ) {
    const source = normalizeIdentifier(slot.sourceLogicalMatchKey);
    if (!isValidIdentifier(source)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_FIELD_MISSING,
        path: `${path}.sourceLogicalMatchKey`,
        message: `${kind} requires sourceLogicalMatchKey`,
        relatedMatchIds: [matchKey],
      });
      return null;
    }
    if (!byKey.has(source)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY,
        path: `${path}.sourceLogicalMatchKey`,
        message: `unknown dependency source: ${source}`,
        relatedMatchIds: [matchKey, source],
      });
      return null;
    }
    if (source === matchKey) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.SELF_MATCH_DEPENDENCY,
        path,
        message: "participant slot dependency cannot reference the same match",
        relatedMatchIds: [matchKey],
      });
      return null;
    }
    const depType =
      kind === PARTICIPANT_SLOT_KIND.WINNER_OF
        ? SCHEDULE_DEPENDENCY_TYPE.WINNER_OF
        : SCHEDULE_DEPENDENCY_TYPE.LOSER_OF;
    const token = `${depType}:${source}`;
    return {
      participant: createScheduleParticipantReference({
        participantId: token,
        kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER,
      }),
      dependency: createScheduleDependency({
        sourceMatchId: source,
        type: depType,
      }),
      kind: "PLACEHOLDER",
    };
  }

  if (
    kind === PARTICIPANT_SLOT_KIND.UNRESOLVED_PLACEMENT ||
    (slot.dependency &&
      normalizeIdentifier(slot.dependency.type) ===
        MATCH_DEPENDENCY_TYPE.DRAW_PLACEMENT)
  ) {
    const placementRef = normalizeIdentifier(
      slot.placementRef || slot.dependency?.placementRef
    );
    if (!isValidIdentifier(placementRef)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.PLACEMENT_IDENTITY_MISSING,
        path: `${path}.placementRef`,
        message: "placement slot requires placementRef and enrichment",
        relatedMatchIds: [matchKey],
      });
      return null;
    }
    const enriched = bundle.placementIdentityByRef.get(placementRef);
    if (!enriched) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.PLACEMENT_IDENTITY_MISSING,
        path: `${path}.placementRef`,
        message: `no placementIdentityByRef for ${placementRef}`,
        relatedMatchIds: [matchKey],
        details: { placementRef },
      });
      return null;
    }
    const resolvedKind =
      enriched.kind || bundle.defaultDirectParticipantKind || "";
    if (!resolvedKind) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_PARTICIPANT_IDENTITY_MISSING,
        path: `${path}.placementRef`,
        message: "placement enrichment requires kind or defaultDirectParticipantKind",
        relatedMatchIds: [matchKey],
      });
      return null;
    }
    /** @type {Record<string, unknown>} */
    const partial = {
      participantId: enriched.participantId,
      kind: resolvedKind,
    };
    if (enriched.teamId) partial.teamId = enriched.teamId;
    if (enriched.constraintResourceIds) {
      partial.constraintResourceIds = enriched.constraintResourceIds;
    }
    return {
      participant: createScheduleParticipantReference(partial),
      kind: "CONCRETE",
    };
  }

  push({
    code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_PARTICIPANT_IDENTITY_MISSING,
    path,
    message: `unsupported or unresolved participant slot kind: ${kind || "(missing)"}`,
    relatedMatchIds: [matchKey],
  });
  return null;
}

function normalizeIncomingDependencies(args) {
  const { match, matchKey, path, byKey, outgoing, slotDeps, push } = args;
  /** @type {Map<string, { sourceMatchId: string, type: string }>} */
  const edges = new Map();
  let localOk = true;

  const addEdge = (type, sourceMatchId, originPath) => {
    const t = normalizeIdentifier(type);
    const s = normalizeIdentifier(sourceMatchId);
    if (!t || !s) return;
    if (
      t !== SCHEDULE_DEPENDENCY_TYPE.WINNER_OF &&
      t !== SCHEDULE_DEPENDENCY_TYPE.LOSER_OF
    ) {
      if (
        t === MATCH_DEPENDENCY_TYPE.DRAW_PLACEMENT ||
        t === MATCH_DEPENDENCY_TYPE.DIRECT_PARTICIPANT ||
        t === MATCH_DEPENDENCY_TYPE.BYE
      ) {
        return;
      }
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_DEPENDENCY_UNSUPPORTED,
        path: originPath,
        message: `unsupported schedule dependency type: ${t}`,
        relatedMatchIds: [matchKey],
        details: { type: t },
      });
      localOk = false;
      return;
    }
    if (!byKey.has(s)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY,
        path: originPath,
        message: `unknown dependency source: ${s}`,
        relatedMatchIds: [matchKey, s],
      });
      localOk = false;
      return;
    }
    if (s === matchKey) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.SELF_MATCH_DEPENDENCY,
        path: originPath,
        message: "self-dependency is not allowed",
        relatedMatchIds: [matchKey],
      });
      localOk = false;
      return;
    }
    const key = `${t}\0${s}`;
    edges.set(key, { sourceMatchId: s, type: t });
  };

  for (const dep of slotDeps) {
    if (dep) addEdge(dep.type, dep.sourceMatchId, `${path}.participantSlot`);
  }

  const inputs = Array.isArray(match.dependencyInputs)
    ? match.dependencyInputs
    : [];
  inputs.forEach((d, i) => {
    if (!d || typeof d !== "object") return;
    const t = normalizeIdentifier(d.type);
    if (
      t === MATCH_DEPENDENCY_TYPE.DRAW_PLACEMENT ||
      t === MATCH_DEPENDENCY_TYPE.DIRECT_PARTICIPANT ||
      t === MATCH_DEPENDENCY_TYPE.BYE
    ) {
      return;
    }
    if (
      t !== MATCH_DEPENDENCY_TYPE.WINNER_OF &&
      t !== MATCH_DEPENDENCY_TYPE.LOSER_OF
    ) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_DEPENDENCY_UNSUPPORTED,
        path: `${path}.dependencyInputs[${i}]`,
        message: `unsupported dependencyInputs type: ${t || "(missing)"}`,
        relatedMatchIds: [matchKey],
      });
      localOk = false;
      return;
    }
    addEdge(t, d.logicalMatchKey, `${path}.dependencyInputs[${i}]`);
  });

  for (const [sourceKey, outs] of outgoing) {
    for (const edge of outs) {
      if (edge.targetKey !== matchKey) continue;
      const expectedType =
        edge.type === MATCH_DEPENDENCY_TYPE.LOSER_OF ||
        edge.type === SCHEDULE_DEPENDENCY_TYPE.LOSER_OF
          ? SCHEDULE_DEPENDENCY_TYPE.LOSER_OF
          : SCHEDULE_DEPENDENCY_TYPE.WINNER_OF;
      const key = `${expectedType}\0${sourceKey}`;
      if (!edges.has(key)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_DEPENDENCY_INCONSISTENT,
          path,
          message:
            "outgoing winnerTo/loserTo is not confirmed by dependent incoming dependencies",
          relatedMatchIds: [matchKey, sourceKey],
          details: { expectedType, sourceMatchId: sourceKey },
        });
        localOk = false;
      }
    }
  }

  for (const edge of edges.values()) {
    const outs = outgoing.get(edge.sourceMatchId) || [];
    if (outs.length === 0) continue;
    const confirmed = outs.some(
      (o) =>
        o.targetKey === matchKey &&
        (o.type === edge.type ||
          (edge.type === SCHEDULE_DEPENDENCY_TYPE.WINNER_OF &&
            o.type === MATCH_DEPENDENCY_TYPE.WINNER_OF) ||
          (edge.type === SCHEDULE_DEPENDENCY_TYPE.LOSER_OF &&
            o.type === MATCH_DEPENDENCY_TYPE.LOSER_OF))
    );
    const hasAnyToThis = outs.some((o) => o.targetKey === matchKey);
    if (hasAnyToThis && !confirmed) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_PLAN_DEPENDENCY_INCONSISTENT,
        path,
        message: "incoming dependency type contradicts source outgoing pointer",
        relatedMatchIds: [matchKey, edge.sourceMatchId],
      });
      localOk = false;
    }
  }

  const dependencies = [...edges.values()]
    .sort((a, b) => {
      const c = asciiCompare(a.sourceMatchId, b.sourceMatchId);
      return c !== 0 ? c : asciiCompare(a.type, b.type);
    })
    .map((e) =>
      createScheduleDependency({
        sourceMatchId: e.sourceMatchId,
        type: e.type,
      })
    );

  return { ok: localOk, dependencies };
}

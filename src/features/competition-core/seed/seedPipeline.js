import {
  CANONICAL_SEED_SOURCE,
  DEFAULT_SEED_TIEBREAK_ORDER,
  SEED_ENGINE_VERSION,
  SEED_PIPELINE_STAGE,
} from "./seedConstants.js";
import {
  buildReferenceSeedReason,
  computeReferenceSeedScoreComponents,
  estimateReferenceSeedConfidence,
  resolveReferenceRatingSource,
} from "./seedScoreModel.js";
import { sortParticipantsForSeedRank } from "./seedTieBreakModel.js";
import {
  createCanonicalSeedObject,
  createSeedAdjustment,
  createSeedAudit,
  createSeedComputation,
  createSeedExplanation,
  createSeedResult,
} from "./seedContracts.js";

function participantId(participant, index) {
  return String(participant.id ?? participant.participantId ?? participant.playerId ?? `p-${index + 1}`);
}

/**
 * Normalize raw participant list for seed pipeline input.
 *
 * @param {Array<Record<string, unknown>>} [participants]
 * @returns {Array<Record<string, unknown>>}
 */
export function normalizeSeedParticipants(participants = []) {
  return (participants || []).map((item, index) => ({
    ...item,
    participantId: participantId(item, index),
  }));
}

/**
 * Resolve adjustments array from participant payload.
 *
 * @param {Record<string, unknown>} participant
 * @returns {import('./seedTypes.js').SeedAdjustment[]}
 */
export function resolveSeedAdjustments(participant = {}) {
  /** @type {import('./seedTypes.js').SeedAdjustment[]} */
  const adjustments = [];

  if (participant.manualPriority != null) {
    adjustments.push(
      createSeedAdjustment({
        kind: CANONICAL_SEED_SOURCE.MANUAL_ADJUSTMENT,
        value: Number(participant.manualPriority),
        reason: "Manual priority bump",
      })
    );
  }

  if (participant.manualAdjustment != null) {
    adjustments.push(
      createSeedAdjustment({
        kind: CANONICAL_SEED_SOURCE.MANUAL_ADJUSTMENT,
        value: Number(participant.manualAdjustment),
        reason: "Manual adjustment",
      })
    );
  }

  if (participant.tournamentOverride === true || participant.stripped === true) {
    adjustments.push(
      createSeedAdjustment({
        kind: CANONICAL_SEED_SOURCE.TOURNAMENT_OVERRIDE,
        value: 0,
        reason: "Tournament mode stripped seed/rating metadata",
      })
    );
  }

  return adjustments;
}

/**
 * Foundation-only canonical seed pipeline.
 * Does NOT invoke legacy/runtime seed engines.
 *
 * Input → Normalize → Resolve rating source → Resolve adjustments
 * → Compute canonical seed score → Seed rank → Tie-break → Seed object
 *
 * @param {import('./seedTypes.js').SeedRequest} request
 * @returns {import('./seedTypes.js').SeedResult}
 */
export function runCanonicalSeedPipeline(request = {}) {
  const weights = request.weights || {};
  const tieBreakOrder = request.tieBreakOrder || DEFAULT_SEED_TIEBREAK_ORDER;

  const normalized = normalizeSeedParticipants(request.participants);
  /** @type {import('./seedTypes.js').SeedComputation[]} */
  const computations = [];
  /** @type {import('./seedTypes.js').SeedExplanation[]} */
  const explanations = [];

  const scored = normalized.map((participant) => {
    const resolvedSource = resolveReferenceRatingSource(participant);
    const adjustments = resolveSeedAdjustments(participant);
    const score = computeReferenceSeedScoreComponents(participant, weights);
    const confidence = estimateReferenceSeedConfidence(participant);
    const seedReason = buildReferenceSeedReason(resolvedSource, score, adjustments);

    const computation = createSeedComputation({
      participantId: participant.participantId,
      resolvedSource,
      score,
      adjustments,
      confidence,
      provisional: participant.provisional === true,
      manualOverride:
        participant.manualOverride === true || participant.manualSeedOverride != null,
      seedReason,
    });
    computations.push(computation);

    return {
      ...participant,
      seedScore: score.total,
      resolvedSource,
      adjustments,
      confidence,
      seedReason,
      provisional: computation.provisional,
      manualOverride: computation.manualOverride,
    };
  });

  const { sorted, tieBreaks } = sortParticipantsForSeedRank(scored, tieBreakOrder);

  /** @type {import('./seedTypes.js').CanonicalSeedObject[]} */
  const seeds = sorted.map((participant, index) => {
    const seedNumber = index + 1;
    const explanation = createSeedExplanation({
      code: "canonical_seed_assignment",
      title: "Canonical seed assignment",
      message: `${participant.name || participant.participantId} assigned seed #${seedNumber}`,
      participantId: participant.participantId,
      seedNumber,
      path: [
        String(participant.name || participant.participantId),
        `Seed #${seedNumber}`,
        "Reason",
        String(participant.seedReason),
        "Final score",
        String(participant.seedScore ?? ""),
      ],
      reasons: [String(participant.seedReason)],
      finalScore: Number(participant.seedScore ?? 0),
    });
    explanations.push(explanation);

    return createCanonicalSeedObject({
      participantId: participant.participantId,
      entryId: participant.entryId != null ? String(participant.entryId) : null,
      seedNumber,
      seedScore: Number(participant.seedScore ?? 0),
      seedReason: participant.seedReason,
      source: participant.resolvedSource,
      confidence: participant.confidence,
      adjustments: participant.adjustments,
      provisional: participant.provisional === true,
      manualOverride: participant.manualOverride === true,
      rankingSnapshot: {
        rank: seedNumber,
        seedScore: Number(participant.seedScore ?? 0),
        primarySource: participant.resolvedSource,
        metrics: {
          competitionElo: participant.competitionElo ?? participant.elo ?? null,
          averageLevel: participant.averageLevel ?? participant.level ?? participant.rating ?? null,
          winRate: participant.winRate ?? null,
          performance: participant.performance ?? participant.recentPerformance ?? null,
        },
      },
    });
  });

  const audit = createSeedAudit({
    sourceValues: {
      participantCount: normalized.length,
      weights,
      tieBreakOrder,
    },
    weights,
    adjustments: computations.flatMap((item) => item.adjustments),
    finalScore: seeds[0]?.seedScore ?? null,
    tieBreaks,
    engineVersion: SEED_ENGINE_VERSION,
  });

  return createSeedResult({
    ok: seeds.length > 0,
    seeds,
    computations,
    explanations,
    audit,
    metadata: {
      pipelineVersion: SEED_ENGINE_VERSION,
      stages: Object.values(SEED_PIPELINE_STAGE),
    },
  });
}

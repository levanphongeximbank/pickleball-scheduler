import {
  DEFAULT_SEED_TIEBREAK_ORDER,
  SEED_TIEBREAK_KIND,
} from "./seedConstants.js";

function compareDesc(a, b) {
  if (a == null && b == null) {
    return 0;
  }
  if (a == null) {
    return 1;
  }
  if (b == null) {
    return -1;
  }
  if (a === b) {
    return 0;
  }
  return a > b ? -1 : 1;
}

/**
 * Apply one tie-break comparison between two participants.
 *
 * @param {string} kind
 * @param {Record<string, unknown>} left
 * @param {Record<string, unknown>} right
 * @returns {{ decided: boolean, winnerId: string|null, reason: string|null }}
 */
export function applySeedTieBreakKind(kind, left, right) {
  const leftId = String(left.participantId || left.id || "");
  const rightId = String(right.participantId || right.id || "");

  switch (kind) {
    case SEED_TIEBREAK_KIND.MANUAL_SEED: {
      const leftManual = left.manualSeedNumber ?? left.manualSeedOverride;
      const rightManual = right.manualSeedNumber ?? right.manualSeedOverride;
      if (leftManual != null || rightManual != null) {
        const cmp = compareDesc(leftManual, rightManual);
        if (cmp !== 0) {
          return {
            decided: true,
            winnerId: cmp < 0 ? leftId : rightId,
            reason: "Manual seed number",
          };
        }
      }
      return { decided: false, winnerId: null, reason: null };
    }
    case SEED_TIEBREAK_KIND.HIGHER_ELO: {
      const cmp = compareDesc(
        left.competitionElo ?? left.elo,
        right.competitionElo ?? right.elo
      );
      if (cmp !== 0) {
        return { decided: true, winnerId: cmp < 0 ? leftId : rightId, reason: "Higher Elo" };
      }
      return { decided: false, winnerId: null, reason: null };
    }
    case SEED_TIEBREAK_KIND.HIGHER_WIN_RATE: {
      const cmp = compareDesc(left.winRate, right.winRate);
      if (cmp !== 0) {
        return {
          decided: true,
          winnerId: cmp < 0 ? leftId : rightId,
          reason: "Higher win rate",
        };
      }
      return { decided: false, winnerId: null, reason: null };
    }
    case SEED_TIEBREAK_KIND.HIGHER_PERFORMANCE: {
      const cmp = compareDesc(left.performance ?? left.recentPerformance, right.performance ?? right.recentPerformance);
      if (cmp !== 0) {
        return {
          decided: true,
          winnerId: cmp < 0 ? leftId : rightId,
          reason: "Higher performance",
        };
      }
      return { decided: false, winnerId: null, reason: null };
    }
    case SEED_TIEBREAK_KIND.REGISTRATION_TIME: {
      const leftTime = left.registrationTime ?? left.registeredAt;
      const rightTime = right.registrationTime ?? right.registeredAt;
      if (leftTime != null && rightTime != null && leftTime !== rightTime) {
        return {
          decided: true,
          winnerId: String(leftTime) < String(rightTime) ? leftId : rightId,
          reason: "Earlier registration time",
        };
      }
      return { decided: false, winnerId: null, reason: null };
    }
    case SEED_TIEBREAK_KIND.RANDOM_SEED: {
      const leftKey = String(left.randomTieKey ?? left.id ?? "");
      const rightKey = String(right.randomTieKey ?? right.id ?? "");
      if (leftKey !== rightKey) {
        return {
          decided: true,
          winnerId: leftKey < rightKey ? leftId : rightId,
          reason: "Deterministic random seed tie-break",
        };
      }
      return { decided: false, winnerId: null, reason: null };
    }
    default:
      return { decided: false, winnerId: null, reason: null };
  }
}

/**
 * Compare two participants using configured tie-break order.
 *
 * @param {Record<string, unknown>} left
 * @param {Record<string, unknown>} right
 * @param {string[]} [order]
 * @returns {{ cmp: number, tieBreaks: import('./seedTypes.js').SeedTieBreak[] }}
 */
export function compareParticipantsWithTieBreak(
  left,
  right,
  order = DEFAULT_SEED_TIEBREAK_ORDER
) {
  /** @type {import('./seedTypes.js').SeedTieBreak[]} */
  const tieBreaks = [];

  const leftScore = Number(left.seedScore ?? left.score ?? 0);
  const rightScore = Number(right.seedScore ?? right.score ?? 0);
  if (leftScore !== rightScore) {
    return { cmp: leftScore > rightScore ? -1 : 1, tieBreaks };
  }

  for (let index = 0; index < order.length; index += 1) {
    const kind = order[index];
    const result = applySeedTieBreakKind(kind, left, right);
    if (result.decided) {
      tieBreaks.push({
        kind,
        order: index + 1,
        winnerParticipantId: result.winnerId,
        loserParticipantId: result.winnerId === String(left.id || left.participantId)
          ? String(right.id || right.participantId)
          : String(left.id || left.participantId),
        reason: result.reason,
      });
      const winnerIsLeft = result.winnerId === String(left.id || left.participantId);
      return { cmp: winnerIsLeft ? -1 : 1, tieBreaks };
    }
  }

  return { cmp: 0, tieBreaks };
}

/**
 * Sort participants by seed score then tie-break chain.
 *
 * @param {Array<Record<string, unknown>>} participants
 * @param {string[]} [order]
 * @returns {{ sorted: Array<Record<string, unknown>>, tieBreaks: import('./seedTypes.js').SeedTieBreak[] }}
 */
export function sortParticipantsForSeedRank(participants = [], order = DEFAULT_SEED_TIEBREAK_ORDER) {
  const items = [...participants];
  /** @type {import('./seedTypes.js').SeedTieBreak[]} */
  const allTieBreaks = [];

  items.sort((a, b) => {
    const { cmp, tieBreaks } = compareParticipantsWithTieBreak(a, b, order);
    allTieBreaks.push(...tieBreaks);
    return cmp;
  });

  return { sorted: items, tieBreaks: allTieBreaks };
}

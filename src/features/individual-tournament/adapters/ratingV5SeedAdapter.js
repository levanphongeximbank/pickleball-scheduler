/**
 * Rating V5 seed adapter (S1-D) — consume only, no Rating V5 calculation edits.
 * Prefer player snapshot fields: displayRating / ratingV5.display_rating / reliability_score.
 */

export const SEED_RATING_SOURCE = {
  RATING_V5: "rating_v5",
  ELO: "elo",
  SKILL: "skill",
  NONE: "none",
};

export function getPlayerReliabilityScore(player) {
  if (player?.reliabilityScore != null && Number.isFinite(Number(player.reliabilityScore))) {
    return Number(player.reliabilityScore);
  }
  if (player?.ratingV5?.reliability_score != null) {
    return Number(player.ratingV5.reliability_score);
  }
  if (player?.pickVnRating?.reliability_score != null) {
    return Number(player.pickVnRating.reliability_score);
  }
  return null;
}

function getTrueRatingV5Display(player) {
  if (player?.displayRating != null && Number.isFinite(Number(player.displayRating))) {
    const value = Number(player.displayRating);
    // Elo-style values are not V5 display ratings (typically 1.5–6.0)
    if (value > 10) return null;
    return value;
  }
  if (player?.ratingV5?.display_rating != null) {
    return Number(player.ratingV5.display_rating);
  }
  if (player?.pickVnRating?.display_rating != null) {
    return Number(player.pickVnRating.display_rating);
  }
  return null;
}

export function resolveMemberSeedRating(player) {
  const v5Display = getTrueRatingV5Display(player);
  if (v5Display != null && Number.isFinite(v5Display)) {
    return {
      displayRating: v5Display,
      reliabilityScore: getPlayerReliabilityScore(player),
      source: SEED_RATING_SOURCE.RATING_V5,
    };
  }
  if (player?.elo != null && Number.isFinite(Number(player.elo))) {
    return {
      displayRating: null,
      reliabilityScore: null,
      source: SEED_RATING_SOURCE.ELO,
      elo: Number(player.elo),
    };
  }
  if (player?.skillLevel != null || player?.rating != null) {
    return {
      displayRating: null,
      reliabilityScore: null,
      source: SEED_RATING_SOURCE.SKILL,
    };
  }
  return {
    displayRating: null,
    reliabilityScore: null,
    source: SEED_RATING_SOURCE.NONE,
  };
}

/**
 * Average Rating V5 display across doubles partners; singles uses single value.
 */
export function resolveEntrySeedRating(members = []) {
  if (!members.length) {
    return {
      displayRating: null,
      reliabilityScore: null,
      source: SEED_RATING_SOURCE.NONE,
      memberSources: [],
    };
  }

  const resolved = members.map(resolveMemberSeedRating);
  const withDisplay = resolved.filter((item) => item.displayRating != null);
  if (withDisplay.length > 0) {
    const avg =
      withDisplay.reduce((sum, item) => sum + item.displayRating, 0) / withDisplay.length;
    const reliabilities = withDisplay
      .map((item) => item.reliabilityScore)
      .filter((value) => value != null);
    const avgRel = reliabilities.length
      ? reliabilities.reduce((sum, value) => sum + value, 0) / reliabilities.length
      : null;
    const allV5 = withDisplay.every((item) => item.source === SEED_RATING_SOURCE.RATING_V5);
    return {
      displayRating: Math.round(avg * 1000) / 1000,
      reliabilityScore: avgRel != null ? Math.round(avgRel * 1000) / 1000 : null,
      source: allV5 ? SEED_RATING_SOURCE.RATING_V5 : SEED_RATING_SOURCE.ELO,
      memberSources: resolved.map((item) => item.source),
    };
  }

  if (resolved.some((item) => item.source === SEED_RATING_SOURCE.ELO)) {
    return {
      displayRating: null,
      reliabilityScore: null,
      source: SEED_RATING_SOURCE.ELO,
      memberSources: resolved.map((item) => item.source),
    };
  }

  return {
    displayRating: null,
    reliabilityScore: null,
    source: resolved[0]?.source || SEED_RATING_SOURCE.NONE,
    memberSources: resolved.map((item) => item.source),
  };
}

export function enrichParticipantWithRatingV5(participant, members = []) {
  const rating = resolveEntrySeedRating(members);
  return {
    ...participant,
    displayRating: rating.displayRating,
    reliabilityScore: rating.reliabilityScore,
    seedRatingSource: rating.source,
  };
}

/**
 * Map display rating (≈1.5–6.0) into the seed elo-normalized range used by seedEngine.
 * Higher display rating → higher seed score.
 */
export function displayRatingToSeedSkill(displayRating) {
  if (displayRating == null || !Number.isFinite(Number(displayRating))) {
    return null;
  }
  // Map 1.5–6.0 → ~600–1400 elo-equivalent for existing normalize formula
  const clamped = Math.min(6, Math.max(1.5, Number(displayRating)));
  return 600 + ((clamped - 1.5) / 4.5) * 800;
}

export function buildSeedBand(seedNumber, bandSize = 4) {
  if (seedNumber == null) return null;
  const band = Math.floor((Number(seedNumber) - 1) / bandSize) + 1;
  return {
    band,
    label: `Band ${band}`,
    bandSize,
  };
}

export function attachSeedBands(participants = [], bandSize = 4) {
  return participants.map((participant) => ({
    ...participant,
    seedBand: participant.seed != null ? buildSeedBand(participant.seed, bandSize) : null,
  }));
}

export function verifySeedIntegrity(participants = []) {
  const errors = [];
  const seeded = participants.filter((item) => item.seed != null);
  const seeds = seeded.map((item) => Number(item.seed)).sort((a, b) => a - b);
  for (let index = 0; index < seeds.length; index += 1) {
    if (seeds[index] !== index + 1) {
      errors.push(`Seed sequence broken at ${seeds[index]} (expected ${index + 1}).`);
      break;
    }
  }
  const protectedCount = participants.filter((item) => item.manualSeedOverride).length;
  return {
    ok: errors.length === 0,
    errors,
    seededCount: seeded.length,
    protectedCount,
  };
}

export function applyManualSeedOverride(participants = [], entryId, seedNumber, options = {}) {
  const targetId = String(entryId);
  const nextSeed = Number(seedNumber);
  if (!Number.isFinite(nextSeed) || nextSeed < 1) {
    return { ok: false, error: "Seed không hợp lệ." };
  }
  if (!options.hasPermission) {
    return { ok: false, error: "Không có quyền chỉnh seed.", code: "SEED_FORBIDDEN" };
  }

  const next = participants.map((participant) => {
    if (String(participant.id) !== targetId) {
      return participant;
    }
    return {
      ...participant,
      seed: nextSeed,
      manualSeedOverride: true,
      seedReason: `Chỉnh tay bởi BTC → seed #${nextSeed}`,
      unseeded: false,
    };
  });

  return { ok: true, participants: next };
}

export function appendSeedAudit(tournament, entry, options = {}) {
  const log = Array.isArray(tournament?.settings?.seedAuditLog)
    ? tournament.settings.seedAuditLog
    : [];
  const auditEntry = {
    id: `seed-audit-${Date.now()}`,
    action: entry.action || "seed_generated",
    actor: entry.actor || null,
    detail: entry.detail || "",
    before: entry.before ?? null,
    after: entry.after ?? null,
    timestamp: options.now || new Date().toISOString(),
  };
  return {
    tournament: {
      ...tournament,
      settings: {
        ...(tournament.settings || {}),
        seedAuditLog: [...log, auditEntry].slice(-50),
      },
    },
    auditEntry,
  };
}

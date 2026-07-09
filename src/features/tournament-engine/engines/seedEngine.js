import {
  DEFAULT_SEED_WEIGHTS,
  INELIGIBLE_SEED_STATUSES,
  PARTICIPANT_STATUS,
  UNSEEDED_THRESHOLD_MATCHES,
} from "../constants/defaults.js";
import { validateSeedInput } from "../validation/tournamentValidation.js";

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWeights(weights = {}) {
  const merged = { ...DEFAULT_SEED_WEIGHTS, ...weights };
  const total = Object.values(merged).reduce((sum, v) => sum + Number(v || 0), 0);
  if (total <= 0) {
    return { ...DEFAULT_SEED_WEIGHTS };
  }
  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, Number(value) / total])
  );
}

function playerSkill(participant) {
  if (participant.elo != null && Number.isFinite(Number(participant.elo))) {
    return Number(participant.elo);
  }
  if (participant.skillLevel != null && Number.isFinite(Number(participant.skillLevel))) {
    return Number(participant.skillLevel) * 200;
  }
  return 700;
}

function buildSeedReason(participant, breakdown) {
  const parts = [];
  if (breakdown.elo > 0) {
    parts.push(`ELO ${participant.elo ?? "—"}`);
  } else if (breakdown.skillLevel > 0) {
    parts.push(`Trình độ ${participant.skillLevel ?? "—"}`);
  }
  if (breakdown.winRate > 0 && participant.winRate != null) {
    parts.push(`Tỷ lệ thắng ${Math.round(participant.winRate * 100)}%`);
  }
  if (breakdown.recentPerformance > 0) {
    parts.push("Phong độ gần đây");
  }
  if (participant.manualSeedOverride) {
    parts.push("Chỉnh tay bởi BTC");
  }
  if (participant.unseeded) {
    return "VĐV mới — chưa đủ dữ liệu, xếp nhóm unseeded";
  }
  return parts.length ? parts.join(" · ") : "Xếp theo tổng điểm seed";
}

function computeSeedBreakdown(participant, weights) {
  const eloNorm = clamp((playerSkill(participant) - 600) / 800);
  const skillNorm = clamp((Number(participant.skillLevel || 3) - 1.0) / 7.0);
  const winRateNorm = clamp(Number(participant.winRate ?? 0.5));
  const recentNorm = clamp(Number(participant.recentPerformance ?? 0.5));
  const manualNorm = clamp(Number(participant.manualPriority ?? 0));

  return {
    elo: eloNorm * weights.elo,
    skillLevel: participant.elo == null ? skillNorm * weights.skillLevel : 0,
    winRate: winRateNorm * weights.winRate,
    recentPerformance: recentNorm * weights.recentPerformance,
    manualPriority: manualNorm * weights.manualPriority,
  };
}

function computeSeedScore(participant, weights) {
  const breakdown = computeSeedBreakdown(participant, weights);
  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { score: Math.round(total * 1000) / 1000, breakdown };
}

function isNewPlayer(participant) {
  const played = Number(participant.matchesPlayed ?? 0);
  return played < UNSEEDED_THRESHOLD_MATCHES && participant.elo == null;
}

/**
 * @param {import('../types/tournamentTypes.js').EngineContext} context
 */
export function generateSeed(context = {}) {
  const validation = validateSeedInput(context);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, warnings: validation.warnings };
  }

  const weights = normalizeWeights(context.seedWeights);
  const warnings = [...validation.warnings];
  const explain = [];

  const eligible = [];
  const excluded = [];

  (context.participants || []).forEach((participant) => {
    const status = String(participant.status || PARTICIPANT_STATUS.ACTIVE);
    if (INELIGIBLE_SEED_STATUSES.has(status)) {
      excluded.push({
        ...participant,
        seed: null,
        seedScore: 0,
        seedReason: `Không đủ điều kiện (${status})`,
      });
      return;
    }
    eligible.push(participant);
  });

  const scored = eligible.map((participant) => {
    if (participant.manualSeedOverride && participant.seed != null) {
      return {
        ...participant,
        seedScore: participant.seedScore ?? 9999 - Number(participant.seed),
        seedReason: buildSeedReason(participant, {}),
        unseeded: false,
      };
    }

    const isUnseeded = isNewPlayer(participant) || participant.unseeded === true;
    const { score, breakdown } = computeSeedScore(participant, weights);

    if (isUnseeded) {
      warnings.push(`${participant.name}: mới / thiếu dữ liệu → unseeded`);
    }

    return {
      ...participant,
      seedScore: score,
      seedReason: buildSeedReason({ ...participant, unseeded: isUnseeded }, breakdown),
      unseeded: isUnseeded,
    };
  });

  const seededPool = scored
    .filter((p) => !p.unseeded)
    .sort((a, b) => b.seedScore - a.seedScore);

  const unseededPool = scored.filter((p) => p.unseeded);

  let seedNumber = 1;
  const seeded = seededPool.map((participant) => {
    const result = { ...participant, seed: seedNumber };
    seedNumber += 1;
    return result;
  });

  const unseeded = unseededPool.map((participant) => ({
    ...participant,
    seed: null,
  }));

  const all = [...seeded, ...unseeded, ...excluded];
  explain.push(`${seeded.length} hạt giống, ${unseeded.length} unseeded, ${excluded.length} loại.`);

  return {
    ok: true,
    data: {
      participants: all,
      seeded,
      unseeded,
      excluded,
    },
    score: seeded.length ? seeded[0].seedScore : 0,
    warnings,
    explain,
  };
}

export { normalizeWeights, computeSeedScore, playerSkill };

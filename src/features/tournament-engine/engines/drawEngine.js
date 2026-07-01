import { createGroupRecord } from "../../../models/tournament/group.js";
import { assignEntriesToGroupsSnake, summarizeGroupBalance } from "../../../tournament/engines/seededGroupEngine.js";
import { DRAW_MAX_RETRIES } from "../constants/defaults.js";
import { validateDrawInput } from "../validation/tournamentValidation.js";

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function getGroupLabel(index) {
  if (index >= 0 && index < 26) {
    return String.fromCharCode(65 + index);
  }
  return `G${index + 1}`;
}

function participantRating(participant) {
  if (participant.elo != null) {
    return Number(participant.elo);
  }
  if (participant.skillLevel != null) {
    return Number(participant.skillLevel) * 200;
  }
  return Number(participant.seedScore || 0) * 1000 || 700;
}

function countClubsInGroup(groupMembers) {
  const clubs = new Map();
  groupMembers.forEach((member) => {
    const club = String(member.clubName || "unknown").trim();
    clubs.set(club, (clubs.get(club) || 0) + 1);
  });
  return clubs;
}

function computeDrawScore(groups, groupCount) {
  let score = 1000;
  const sizes = groups.map((g) => g.members.length);
  const maxSize = Math.max(...sizes, 0);
  const minSize = Math.min(...sizes, 0);
  score -= (maxSize - minSize) * 50;

  groups.forEach((group) => {
    const seeds = group.members.filter((m) => m.seed != null).map((m) => Number(m.seed));
    const topSeeds = seeds.filter((s) => s <= groupCount).length;
    if (topSeeds > 1) {
      score -= topSeeds * 30;
    }

    const clubs = countClubsInGroup(group.members);
    clubs.forEach((count) => {
      if (count > 1) {
        score -= (count - 1) * 20;
      }
    });

    const ratings = group.members.map(participantRating);
    const avg = ratings.reduce((a, b) => a + b, 0) / (ratings.length || 1);
    const variance =
      ratings.reduce((sum, r) => sum + (r - avg) ** 2, 0) / (ratings.length || 1);
    score -= Math.sqrt(variance) * 0.05;
  });

  const groupAvgs = groups.map((group) => {
    const ratings = group.members.map(participantRating);
    return ratings.reduce((a, b) => a + b, 0) / (ratings.length || 1);
  });
  const globalAvg = groupAvgs.reduce((a, b) => a + b, 0) / (groupAvgs.length || 1);
  groupAvgs.forEach((avg) => {
    score -= Math.abs(avg - globalAvg) * 0.2;
  });

  return Math.round(score * 100) / 100;
}

function snakeAssign(seededParticipants, groupCount) {
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    label: getGroupLabel(index),
    members: [],
  }));

  const sorted = [...seededParticipants].sort(
    (a, b) => Number(a.seed || 999) - Number(b.seed || 999)
  );

  sorted.forEach((participant, index) => {
    const round = Math.floor(index / groupCount);
    const pos = index % groupCount;
    const groupIndex = round % 2 === 0 ? pos : groupCount - 1 - pos;
    groups[groupIndex].members.push(participant);
  });

  return groups;
}

function balanceUnseeded(groups, unseeded, randomFn) {
  const pool = [...unseeded].sort(() => randomFn() - 0.5);
  pool.forEach((participant) => {
    const target = groups.reduce((best, group) => {
      const size = group.members.length;
      if (!best || size < best.size) {
        return { group, size };
      }
      return best;
    }, null);
    if (target) {
      target.group.members.push(participant);
    }
  });
  return groups;
}

function participantsToEntries(participants, tournamentId, eventId) {
  return participants.map((p) => ({
    id: p.id,
    tournamentId,
    eventId,
    name: p.name,
    playerIds: p.playerIds || [p.id],
    clubName: p.clubName || "",
    rating: participantRating(p),
    seed: p.seed,
    status: p.status || "active",
  }));
}

function groupsToOutput(rawGroups, tournamentId, eventId) {
  return rawGroups.map((group, index) => {
    const entries = participantsToEntries(group.members, tournamentId, eventId);
    return createGroupRecord({
      id: `group-${group.label}-${tournamentId}-${index}`,
      label: group.label,
      name: `Bảng ${group.label}`,
      entryIds: entries.map((e) => e.id),
      entries,
      matches: [],
      standings: [],
      pointsConfig: { win: 2, loss: 1, forfeit: 0 },
    });
  });
}

/**
 * @param {import('../types/tournamentTypes.js').EngineContext} context
 */
export function generateDraw(context = {}) {
  const validation = validateDrawInput(context);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, warnings: validation.warnings };
  }

  const groupCount = Math.max(1, Number(context.groupCount) || 2);
  const randomSeed = Number(context.scheduleConfig?.randomSeed ?? context.randomSeed ?? 42);
  const warnings = [...validation.warnings];
  const explain = [];

  const active = (context.participants || []).filter(
    (p) => !["absent", "injured", "unpaid", "pending", "inactive"].includes(String(p.status))
  );

  const seeded = active.filter((p) => p.seed != null && !p.unseeded);
  const unseeded = active.filter((p) => p.seed == null || p.unseeded);

  let bestGroups = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < DRAW_MAX_RETRIES; attempt += 1) {
    const randomFn = mulberry32(randomSeed + attempt);
    let groups = snakeAssign(seeded, groupCount);
    groups = balanceUnseeded(groups, unseeded, randomFn);

    const totalAssigned = groups.reduce((sum, g) => sum + g.members.length, 0);
    if (totalAssigned !== active.length) {
      continue;
    }

    const drawScore = computeDrawScore(groups, groupCount);
    if (drawScore > bestScore) {
      bestScore = drawScore;
      bestGroups = groups.map((g) => ({
        label: g.label,
        members: [...g.members],
      }));
    }
  }

  if (!bestGroups) {
    const entries = participantsToEntries(active, context.tournamentId, context.eventId);
    const legacyGroups = assignEntriesToGroupsSnake(entries, groupCount, []);
    const balance = summarizeGroupBalance(legacyGroups);
    explain.push("Fallback snake distribution từ engine legacy.");
    return {
      ok: true,
      data: {
        groups: legacyGroups,
        drawScore: balance.balanced ? 800 : 600,
        unassigned: [],
      },
      score: balance.balanced ? 800 : 600,
      warnings,
      explain,
    };
  }

  const groups = groupsToOutput(bestGroups, context.tournamentId, context.eventId);
  const balance = summarizeGroupBalance(groups);

  if (!balance.balanced) {
    warnings.push(`Bảng lệch số lượng: ${balance.min}–${balance.max} đội/bảng.`);
  }

  explain.push(
    `Snake + heuristic balancing sau ${DRAW_MAX_RETRIES} lần thử.`,
    `Draw score: ${bestScore}.`
  );

  bestGroups.forEach((group) => {
    const clubs = [...countClubsInGroup(group.members).entries()];
    if (clubs.some(([, count]) => count > 1)) {
      explain.push(`Bảng ${group.label}: có nhiều đội cùng CLB (cố gắng giảm thiểu).`);
    }
  });

  return {
    ok: true,
    data: {
      groups,
      drawScore: bestScore,
      balance,
      unassigned: [],
    },
    score: bestScore,
    warnings,
    explain,
  };
}

export { computeDrawScore, snakeAssign, mulberry32 };

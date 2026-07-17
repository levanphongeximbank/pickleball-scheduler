import { GENDER_REQUIREMENT } from "../../team-tournament/constants.js";
import { getPlayerGenderKey } from "../../../models/player.js";
import { createSeededRng, seededShuffle } from "../core/seededRandom.js";
import { cloneLineupSelections, validateLineupStructure } from "./lineupConstraints.js";

function getPlayer(playersById, id) {
  return playersById instanceof Map
    ? playersById.get(String(id))
    : playersById[String(id)];
}

function eligibleIds(team, discipline, playersById, used, allowReuse) {
  const teamIds = (team.playerIds || []).map(String);
  const absent = new Set(
    [
      ...(team.absentPlayerIds || []),
      ...(team.lockedPlayerIds || []),
      ...(team.suspendedPlayerIds || []),
    ].map(String)
  );

  return teamIds.filter((playerId) => {
    if (absent.has(playerId)) return false;
    if (!allowReuse && used.has(playerId)) return false;
    const player = getPlayer(playersById, playerId);
    if (!player) return false;
    const gender = getPlayerGenderKey(player.gender);
    if (discipline.genderRequirement === GENDER_REQUIREMENT.MALE) {
      return gender === "male";
    }
    if (discipline.genderRequirement === GENDER_REQUIREMENT.FEMALE) {
      return gender === "female";
    }
    if (discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR) {
      return gender === "male" || gender === "female";
    }
    return true;
  });
}

function pickForDiscipline(discipline, pool, playersById, rng, used, allowReuse) {
  const need = Math.max(1, Number(discipline.playerCount) || 1);
  const eligible = eligibleIds(
    { playerIds: pool },
    discipline,
    playersById,
    used,
    allowReuse
  );
  const shuffled = seededShuffle(eligible, rng);

  if (discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR && need >= 2) {
    const males = shuffled.filter(
      (id) => getPlayerGenderKey(getPlayer(playersById, id)?.gender) === "male"
    );
    const females = shuffled.filter(
      (id) => getPlayerGenderKey(getPlayer(playersById, id)?.gender) === "female"
    );
    if (!males.length || !females.length) return null;
    return [males[0], females[0]];
  }

  if (shuffled.length < need) return null;
  return shuffled.slice(0, need);
}

function buildSelections({
  team,
  disciplines,
  playersById,
  rng,
  allowReuse,
  strategy,
  orderDisciplines,
}) {
  const used = new Set();
  const selections = {};
  const ordered = orderDisciplines
    ? orderDisciplines([...disciplines], rng)
    : [...disciplines];

  for (const discipline of ordered) {
    const picked = pickForDiscipline(
      discipline,
      team.playerIds || [],
      playersById,
      rng,
      used,
      allowReuse
    );
    if (!picked) {
      return null;
    }
    selections[String(discipline.id)] = picked.map(String);
    if (!allowReuse) {
      picked.forEach((id) => used.add(String(id)));
    }
  }

  const structural = validateLineupStructure({
    selections,
    disciplines,
    team,
    playersById,
    allowReuse,
  });
  if (!structural.ok) return null;

  return {
    strategy,
    selections: cloneLineupSelections(selections),
    allowReuse,
  };
}

function byStrength(disciplines, playersById, team, rng, ascending) {
  return (list) => {
    const rated = list.map((discipline) => {
      const eligible = eligibleIds(team, discipline, playersById, new Set(), true);
      const avg =
        eligible.reduce(
          (sum, id) =>
            sum +
            Number(
              getPlayer(playersById, id)?.ratingInternal ??
                getPlayer(playersById, id)?.rating ??
                3.5
            ),
          0
        ) / Math.max(1, eligible.length);
      return { discipline, avg };
    });
    rated.sort((a, b) => (ascending ? a.avg - b.avg : b.avg - a.avg));
    // tiny seeded jitter for diversity
    if (rng() < 0.2 && rated.length > 1) {
      const i = Math.floor(rng() * rated.length) % rated.length;
      const j = Math.floor(rng() * rated.length) % rated.length;
      [rated[i], rated[j]] = [rated[j], rated[i]];
    }
    return rated.map((row) => row.discipline);
  };
}

/**
 * Generate initial lineup candidates (baseline + rotations + seeded random).
 */
export function generateLineupInitialCandidates(input = {}) {
  const {
    team,
    disciplines = [],
    playersById = {},
    previousSelections = null,
    allowReuse = false,
    allowReuseFallback = true,
    randomSeed = 1,
    maxCandidates = 150,
  } = input;

  const rng = createSeededRng(randomSeed);
  const results = [];
  const push = (candidate) => {
    if (!candidate) return;
    if (results.length >= maxCandidates) return;
    results.push(candidate);
  };

  if (previousSelections) {
    const structural = validateLineupStructure({
      selections: previousSelections,
      disciplines,
      team,
      playersById,
      allowReuse,
    });
    if (structural.ok) {
      push({
        strategy: "current_lineup",
        selections: cloneLineupSelections(previousSelections),
        allowReuse,
      });
    }
  }

  const reuseModes = allowReuse
    ? [true]
    : allowReuseFallback
      ? [false, true]
      : [false];

  for (const reuse of reuseModes) {
    push(
      buildSelections({
        team,
        disciplines,
        playersById,
        rng,
        allowReuse: reuse,
        strategy: reuse ? "seeded_random_reuse" : "seeded_random",
      })
    );

    push(
      buildSelections({
        team,
        disciplines,
        playersById,
        rng,
        allowReuse: reuse,
        strategy: "discipline_first",
        orderDisciplines: (list) =>
          [...list].sort((a, b) => String(a.id).localeCompare(String(b.id))),
      })
    );

    push(
      buildSelections({
        team,
        disciplines,
        playersById,
        rng,
        allowReuse: reuse,
        strategy: "strong_weak_balance",
        orderDisciplines: byStrength(disciplines, playersById, team, rng, false),
      })
    );

    push(
      buildSelections({
        team,
        disciplines,
        playersById,
        rng,
        allowReuse: reuse,
        strategy: "fair_play_rotation",
        orderDisciplines: byStrength(disciplines, playersById, team, rng, true),
      })
    );

    // Extra seeded randoms for multi-start diversity
    const extra = Math.min(40, Math.max(0, maxCandidates - results.length));
    for (let i = 0; i < extra; i += 1) {
      push(
        buildSelections({
          team,
          disciplines,
          playersById,
          rng,
          allowReuse: reuse,
          strategy: `seeded_random_${i}`,
          orderDisciplines: (list) => seededShuffle(list, rng),
        })
      );
      if (results.length >= maxCandidates) break;
    }
  }

  return results.slice(0, maxCandidates);
}

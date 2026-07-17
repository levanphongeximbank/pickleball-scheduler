/**
 * Default soft scoring for lineup formation (lower is better).
 */

function playerRating(player) {
  return Number(player?.ratingInternal ?? player?.rating ?? player?.level ?? 3.5) || 3.5;
}

/**
 * @param {Record<string, string[]>} selections
 * @param {Map<string, object>|Record<string, object>} playersById
 * @param {object} [options]
 */
export function computeLineupDefaultPenalty(selections = {}, playersById = {}, options = {}) {
  const getPlayer = (id) =>
    playersById instanceof Map
      ? playersById.get(String(id))
      : playersById[String(id)];

  const appearance = new Map();
  const pairKeys = [];
  const disciplineStrength = [];

  for (const playerIds of Object.values(selections || {})) {
    const ids = (playerIds || []).map(String);
    const ratings = ids.map((id) => playerRating(getPlayer(id)));
    const avg =
      ratings.length > 0
        ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
        : 0;
    disciplineStrength.push(avg);
    ids.forEach((id) => appearance.set(id, (appearance.get(id) || 0) + 1));
    if (ids.length >= 2) {
      pairKeys.push([...ids].sort().join("-"));
    }
  }

  const counts = [...appearance.values()];
  const appearanceSpread =
    counts.length > 0 ? Math.max(...counts) - Math.min(...counts) : 0;
  const overusePenalty = counts.reduce(
    (sum, count) => sum + Math.max(0, count - 2) * 25,
    0
  );

  const uniquePairs = new Set(pairKeys);
  const pairRepeatPenalty = (pairKeys.length - uniquePairs.size) * 40;

  const strengthSpread =
    disciplineStrength.length > 1
      ? (Math.max(...disciplineStrength) - Math.min(...disciplineStrength)) * 20
      : 0;

  const previous = options.previousSelections || null;
  let churnPenalty = 0;
  if (previous) {
    for (const [disciplineId, playerIds] of Object.entries(selections || {})) {
      const prev = new Set((previous[disciplineId] || []).map(String));
      const next = (playerIds || []).map(String);
      next.forEach((id) => {
        if (!prev.has(id)) churnPenalty += 8;
      });
    }
  }

  const eliteIds = [...appearance.keys()]
    .map((id) => ({ id, rating: playerRating(getPlayer(id)) }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 2)
    .map((row) => row.id);
  const eliteOveruse = eliteIds.reduce(
    (sum, id) => sum + Math.max(0, (appearance.get(id) || 0) - 1) * 12,
    0
  );

  return (
    appearanceSpread * 30 +
    overusePenalty +
    pairRepeatPenalty +
    strengthSpread +
    churnPenalty +
    eliteOveruse
  );
}

/**
 * Compact metrics for audit/benchmark.
 */
export function computeLineupFairnessMetrics(selections = {}) {
  const appearance = new Map();
  for (const playerIds of Object.values(selections || {})) {
    (playerIds || []).forEach((id) => {
      const key = String(id);
      appearance.set(key, (appearance.get(key) || 0) + 1);
    });
  }
  const counts = [...appearance.values()];
  return {
    appearanceSpread:
      counts.length > 0 ? Math.max(...counts) - Math.min(...counts) : 0,
    playerCount: appearance.size,
    maxAppearances: counts.length ? Math.max(...counts) : 0,
    minAppearances: counts.length ? Math.min(...counts) : 0,
  };
}

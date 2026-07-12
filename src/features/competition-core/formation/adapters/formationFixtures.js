/** CC-05C fixture matrix — synthetic player pools for shadow parity tests. */

function player(id, overrides = {}) {
  return {
    id,
    name: overrides.name || `Player ${id}`,
    gender: overrides.gender || "male",
    rating: overrides.rating ?? 3.5,
    level: overrides.level ?? overrides.rating ?? 3.5,
    checkedIn: overrides.checkedIn !== false,
    busy: overrides.busy === true,
    ...overrides,
  };
}

export const FORMATION_FIXTURE_MATRIX = Object.freeze([
  { label: "4_players_even", count: 4, build: () => buildMixedPool(4) },
  { label: "5_players_odd", count: 5, build: () => buildMixedPool(5) },
  { label: "8_players", count: 8, build: () => buildMixedPool(8) },
  { label: "12_players", count: 12, build: () => buildMixedPool(12) },
  { label: "20_players", count: 20, build: () => buildMixedPool(20) },
  { label: "all_same_skill", count: 8, build: () => buildMixedPool(8, { rating: 3.5 }) },
  {
    label: "large_skill_spread",
    count: 8,
    build: () => [
      player("m1", { gender: "male", rating: 5.0 }),
      player("m2", { gender: "male", rating: 2.0 }),
      player("m3", { gender: "male", rating: 4.5 }),
      player("m4", { gender: "male", rating: 2.5 }),
      player("f1", { gender: "female", rating: 4.8 }),
      player("f2", { gender: "female", rating: 2.2 }),
      player("f3", { gender: "female", rating: 4.0 }),
      player("f4", { gender: "female", rating: 2.8 }),
    ],
  },
  {
    label: "missing_rating",
    count: 4,
    build: () => [
      player("m1", { gender: "male", rating: undefined, level: undefined }),
      player("m2", { gender: "male" }),
      player("f1", { gender: "female", rating: undefined }),
      player("f2", { gender: "female" }),
    ],
  },
  {
    label: "not_checked_in",
    count: 8,
    build: () =>
      buildMixedPool(8).map((p, i) => ({
        ...p,
        checkedIn: i % 3 !== 0,
      })),
  },
  {
    label: "busy_player",
    count: 8,
    build: () =>
      buildMixedPool(8).map((p, i) => ({
        ...p,
        busy: i === 2,
      })),
  },
]);

function buildMixedPool(total, defaults = {}) {
  const males = Math.ceil(total / 2);
  const females = total - males;
  const players = [];
  for (let i = 0; i < males; i += 1) {
    players.push(
      player(`m${i + 1}`, {
        gender: "male",
        rating: defaults.rating ?? 3.5 + (i % 3) * 0.3,
      })
    );
  }
  for (let i = 0; i < females; i += 1) {
    players.push(
      player(`f${i + 1}`, {
        gender: "female",
        rating: defaults.rating ?? 3.5 + (i % 3) * 0.25,
      })
    );
  }
  return players;
}

/**
 * @param {string} label
 */
export function getFormationFixture(label) {
  return FORMATION_FIXTURE_MATRIX.find((f) => f.label === label) || null;
}

/**
 * Build MLP pairing payload for fixture players.
 *
 * @param {Array<Record<string, unknown>>} players
 * @param {Object} [options]
 */
export function buildMlpFormationPayload(players, options = {}) {
  return {
    strategyKey: "mlp_team_pairing",
    players,
    sessionId: options.sessionId || "fixture-session",
    clubId: options.clubId || "fixture-club",
    venueId: options.venueId || "fixture-venue",
    constraints: options.constraints || [],
    options: {
      selectedPlayerIds: players.map((p) => String(p.id)),
      teamCount: options.teamCount ?? 2,
      teamNames: options.teamNames || ["Team A", "Team B"],
      formatPreset: options.formatPreset || "mlp_4",
      courts: options.courts,
      ...options,
    },
  };
}

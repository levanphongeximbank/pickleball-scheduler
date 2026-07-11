import { RATING_ENGINE_VERSION, RATING_TYPE } from "./ratingConstants.js";

/** @typedef {{ matchId: string, playerId: string, ratingType: string, appliedAt: string, engineVersion: string, beforeRating: number, afterRating: number }} RatingApplication */

/**
 * Stable unique key mirroring SQL unique(match_id, player_id, rating_type).
 *
 * @param {string} matchId
 * @param {string} playerId
 * @param {string} [ratingType]
 */
export function buildRatingApplicationKey(matchId, playerId, ratingType = RATING_TYPE.COMPETITION_ELO) {
  return `${String(matchId)}::${String(playerId)}::${String(ratingType)}`;
}

/**
 * @param {Object|null|undefined} data
 * @returns {RatingApplication[]}
 */
export function getRatingApplicationsFromClubData(data) {
  const raw = data?.ratingV2Applications;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => ({
      matchId: String(entry?.matchId ?? ""),
      playerId: String(entry?.playerId ?? ""),
      ratingType: String(entry?.ratingType ?? RATING_TYPE.COMPETITION_ELO),
      appliedAt: String(entry?.appliedAt ?? ""),
      engineVersion: String(entry?.engineVersion ?? RATING_ENGINE_VERSION),
      beforeRating: Number(entry?.beforeRating),
      afterRating: Number(entry?.afterRating),
    }))
    .filter((entry) => entry.matchId && entry.playerId);
}

/**
 * @param {RatingApplication[]} applications
 * @param {string} matchId
 * @param {string} playerId
 * @param {string} [ratingType]
 */
export function hasRatingApplication(applications, matchId, playerId, ratingType = RATING_TYPE.COMPETITION_ELO) {
  const key = buildRatingApplicationKey(matchId, playerId, ratingType);
  return applications.some(
    (entry) => buildRatingApplicationKey(entry.matchId, entry.playerId, entry.ratingType) === key
  );
}

/**
 * @param {Object} data
 * @param {Array<{ playerId: string, previousRating: number, nextRating: number }>} updates
 * @param {string} matchId
 * @param {Object} [options]
 * @returns {RatingApplication[]}
 */
export function buildRatingApplicationEntries(updates, matchId, options = {}) {
  const appliedAt =
    options.appliedAt ||
    (options.now instanceof Date ? options.now.toISOString() : new Date().toISOString());
  const engineVersion = options.engineVersion || RATING_ENGINE_VERSION;
  const ratingType = options.ratingType || RATING_TYPE.COMPETITION_ELO;

  return (updates || []).map((update) => ({
    matchId: String(matchId),
    playerId: String(update.playerId),
    ratingType,
    appliedAt,
    engineVersion,
    beforeRating: Number(update.previousRating),
    afterRating: Number(update.nextRating),
  }));
}

/**
 * Append applications to club blob — enforces unique(matchId, playerId, ratingType).
 *
 * @param {Object} data
 * @param {RatingApplication[]} newEntries
 * @returns {RatingApplication[]}
 */
export function appendRatingApplicationsToClubData(data, newEntries) {
  const existing = getRatingApplicationsFromClubData(data);
  const index = new Map(
    existing.map((entry) => [
      buildRatingApplicationKey(entry.matchId, entry.playerId, entry.ratingType),
      entry,
    ])
  );

  for (const entry of newEntries) {
    const key = buildRatingApplicationKey(entry.matchId, entry.playerId, entry.ratingType);
    if (index.has(key)) {
      throw new Error(`duplicate-rating-application:${key}`);
    }
    index.set(key, entry);
  }

  const merged = [...index.values()];
  data.ratingV2Applications = merged;
  return merged;
}

/**
 * Legacy match-level marker — local optimization only; not durable idempotency SSOT.
 *
 * @param {Object} data
 * @param {string} matchId
 */
export function hasLegacyMatchLevelApplication(data, matchId) {
  const appliedIds = Array.isArray(data?.ratingV2AppliedMatchIds)
    ? data.ratingV2AppliedMatchIds.map(String)
    : [];
  return appliedIds.includes(String(matchId));
}

/**
 * In-memory store simulating SQL unique constraint for concurrency tests.
 */
export class InMemoryRatingIdempotencyStore {
  constructor() {
    /** @type {Map<string, RatingApplication>} */
    this.applications = new Map();
    /** @type {Promise<void>} */
    this.lock = Promise.resolve();
  }

  /**
   * @param {string} matchId
   * @param {string[]} playerIds
   * @param {string} [ratingType]
   */
  async checkAllAbsent(matchId, playerIds, ratingType = RATING_TYPE.COMPETITION_ELO) {
    return this.withLock(() => {
      for (const playerId of playerIds) {
        const key = buildRatingApplicationKey(matchId, playerId, ratingType);
        if (this.applications.has(key)) {
          return { ok: false, reason: "already-applied", key };
        }
      }
      return { ok: true };
    });
  }

  /**
   * @param {RatingApplication[]} entries
   */
  async registerAll(entries) {
    return this.withLock(() => {
      for (const entry of entries) {
        const key = buildRatingApplicationKey(entry.matchId, entry.playerId, entry.ratingType);
        if (this.applications.has(key)) {
          return { ok: true, skipped: true, reason: "already-applied", idempotent: true, key };
        }
      }

      for (const entry of entries) {
        const key = buildRatingApplicationKey(entry.matchId, entry.playerId, entry.ratingType);
        this.applications.set(key, entry);
      }

      return { ok: true, skipped: false, count: entries.length };
    });
  }

  /**
   * @template T
   * @param {() => T|Promise<T>} fn
   * @returns {Promise<T>}
   */
  async withLock(fn) {
    const run = this.lock.then(fn);
    this.lock = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}

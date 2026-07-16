/**
 * Canonical Pick_VN rating resolution for pairing / Team Tournament athlete reads.
 *
 * Join key: pick_vn_player_ratings.auth_user_id = profiles.id = athletes.user_id
 */

export const CANONICAL_RATING_SOURCE = Object.freeze({
  PICK_VN_CURRENT: "pick_vn_current",
  PICK_VN_PROVISIONAL: "pick_vn_provisional",
  PICK_VN_SELF_DECLARED: "pick_vn_self_declared",
  LEGACY_RATING: "legacy_rating",
  LEGACY_LEVEL: "legacy_level",
  LEGACY_SKILL: "legacy_skill",
  NONE: "none",
});

function normalizeId(value) {
  return String(value || "").trim();
}

/**
 * @param {*} raw
 * @returns {boolean}
 */
export function isPresentRatingValue(raw) {
  return raw !== null && raw !== undefined && raw !== "";
}

/**
 * @param {*} raw
 * @returns {number|null}
 */
export function parseRatingNumber(raw) {
  if (!isPresentRatingValue(raw)) return null;
  const num = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(num) ? num : null;
}

/**
 * Select the current Pick_VN row per auth user (deterministic).
 * Newest last_rating_updated_at wins; then updated_at; then id.
 *
 * @param {object[]} rows
 * @returns {Map<string, object>}
 */
export function buildPickVnRatingIndex(rows = []) {
  const grouped = new Map();

  for (const row of rows || []) {
    const authUserId = normalizeId(row.auth_user_id || row.authUserId);
    if (!authUserId) continue;
    const list = grouped.get(authUserId) || [];
    list.push(row);
    grouped.set(authUserId, list);
  }

  const index = new Map();
  for (const [authUserId, list] of grouped.entries()) {
    const selected = [...list].sort((a, b) => {
      const aTs = Date.parse(a.last_rating_updated_at || a.lastRatingUpdatedAt || "") || 0;
      const bTs = Date.parse(b.last_rating_updated_at || b.lastRatingUpdatedAt || "") || 0;
      if (bTs !== aTs) return bTs - aTs;
      const aUpd = Date.parse(a.updated_at || a.updatedAt || "") || 0;
      const bUpd = Date.parse(b.updated_at || b.updatedAt || "") || 0;
      if (bUpd !== aUpd) return bUpd - aUpd;
      const aId = normalizeId(a.id);
      const bId = normalizeId(b.id);
      if (aId < bId) return 1;
      if (aId > bId) return -1;
      return 0;
    })[0];
    if (selected) index.set(authUserId, selected);
  }

  return index;
}

/**
 * Locked precedence:
 * 1. pick_vn current_rating
 * 2. pick_vn provisional_rating
 * 3. pick_vn self_declared_rating
 * 4. legacy rating / level / skillLevel
 *
 * @param {{
 *   currentRating?: *,
 *   current_rating?: *,
 *   provisionalRating?: *,
 *   provisional_rating?: *,
 *   selfDeclaredRating?: *,
 *   self_declared_rating?: *,
 *   rating?: *,
 *   level?: *,
 *   skillLevel?: *,
 *   skill_level?: *,
 * }} input
 */
export function resolveCanonicalAthleteRating(input = {}) {
  const pickVnCurrent = parseRatingNumber(input.currentRating ?? input.current_rating);
  const pickVnProvisional = parseRatingNumber(
    input.provisionalRating ?? input.provisional_rating
  );
  const pickVnSelfDeclared = parseRatingNumber(
    input.selfDeclaredRating ?? input.self_declared_rating
  );
  const legacyRating = parseRatingNumber(input.rating);
  const legacyLevel = parseRatingNumber(input.level);
  const legacySkill = parseRatingNumber(input.skillLevel ?? input.skill_level);
  const legacyVpr = parseRatingNumber(input.vprRating ?? input.vpr_rating);

  let ratingValue = null;
  let ratingSource = CANONICAL_RATING_SOURCE.NONE;

  if (pickVnCurrent !== null) {
    ratingValue = pickVnCurrent;
    ratingSource = CANONICAL_RATING_SOURCE.PICK_VN_CURRENT;
  } else if (pickVnProvisional !== null) {
    ratingValue = pickVnProvisional;
    ratingSource = CANONICAL_RATING_SOURCE.PICK_VN_PROVISIONAL;
  } else if (pickVnSelfDeclared !== null) {
    ratingValue = pickVnSelfDeclared;
    ratingSource = CANONICAL_RATING_SOURCE.PICK_VN_SELF_DECLARED;
  } else if (legacyRating !== null) {
    ratingValue = legacyRating;
    ratingSource = CANONICAL_RATING_SOURCE.LEGACY_RATING;
  } else if (legacyLevel !== null) {
    ratingValue = legacyLevel;
    ratingSource = CANONICAL_RATING_SOURCE.LEGACY_LEVEL;
  } else if (legacySkill !== null) {
    ratingValue = legacySkill;
    ratingSource = CANONICAL_RATING_SOURCE.LEGACY_SKILL;
  } else if (legacyVpr !== null) {
    ratingValue = legacyVpr;
    ratingSource = CANONICAL_RATING_SOURCE.LEGACY_RATING;
  }

  return {
    currentRating: pickVnCurrent,
    provisionalRating: pickVnProvisional,
    selfDeclaredRating: pickVnSelfDeclared,
    ratingValue,
    ratingLabel: ratingValue !== null ? String(ratingValue) : null,
    ratingSource,
  };
}

/**
 * Attach canonical rating fields to a scope row using optional Pick_VN record.
 *
 * @param {object} row
 * @param {object|null} pickVnRow
 */
export function attachCanonicalRatingToScopeRow(row = {}, pickVnRow = null) {
  const canonical = resolveCanonicalAthleteRating({
    currentRating: pickVnRow?.current_rating ?? pickVnRow?.currentRating,
    provisionalRating: pickVnRow?.provisional_rating ?? pickVnRow?.provisionalRating,
    selfDeclaredRating:
      pickVnRow?.self_declared_rating ?? pickVnRow?.selfDeclaredRating,
    rating: row.rating,
    level: row.level,
    skillLevel: row.skillLevel ?? row.skill_level,
  });

  return {
    ...row,
    ...canonical,
    rating: canonical.ratingValue,
    level: canonical.ratingValue,
  };
}

/**
 * Project canonical rating fields onto legacy player / candidate objects.
 *
 * @param {object} candidate
 */
export function projectCanonicalRatingFields(candidate = {}) {
  const canonical =
    candidate.ratingSource && candidate.ratingValue !== undefined
      ? {
          currentRating: candidate.currentRating ?? null,
          provisionalRating: candidate.provisionalRating ?? null,
          selfDeclaredRating: candidate.selfDeclaredRating ?? null,
          ratingValue: candidate.ratingValue,
          ratingLabel: candidate.ratingLabel ?? null,
          ratingSource: candidate.ratingSource,
        }
      : resolveCanonicalAthleteRating(candidate);

  return {
    currentRating: canonical.currentRating,
    provisionalRating: canonical.provisionalRating,
    selfDeclaredRating: canonical.selfDeclaredRating,
    ratingValue: canonical.ratingValue,
    ratingLabel: canonical.ratingLabel,
    ratingSource: canonical.ratingSource,
    rating: canonical.ratingValue,
    level: canonical.ratingValue,
  };
}

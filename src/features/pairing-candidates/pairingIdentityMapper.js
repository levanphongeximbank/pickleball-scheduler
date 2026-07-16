/**
 * PHASE 45B.3 — Athlete identity mapping repair (pairing infrastructure).
 *
 * Canonical:
 * - pairingIdentityId = athletes.id (ONLY pairing identity)
 * - athletes.user_id = account identity
 * - profiles.player_id / blob|local player ids = legacy aliases only
 *
 * Coverage diagnostics:
 * - mapped   = athleteId present AND profiles.player_id alias present
 * - derived  = athleteId present AND no profilePlayerId, but legacy/blob alias present
 * - unmapped = athleteId present AND neither alias (still eligible — never silent drop)
 *
 * Missing athletes.id → MISSING_IDENTITY_LINK (visible exclusion; never invent id from alias).
 */

import { PAIRING_CANDIDATE_REASON_CODES } from "./pairingCandidateReasonCodes.js";
import { emptyIdentityCoverage } from "./pairingCandidateContract.js";
import { projectCanonicalRatingFields } from "./canonicalAthleteRating.js";

function normalizeId(value) {
  return String(value || "").trim() || null;
}

/**
 * athletes.id only — never promote player_id / blob id / row.id to primary.
 * @param {object} row
 * @returns {string|null}
 */
export function extractAthleteId(row = {}) {
  return normalizeId(row.athleteId || row.athlete_id);
}

/**
 * Collect legacy aliases. Values equal to athletes.id are ignored (not aliases).
 * @param {object} row
 * @param {string|null} athleteId
 * @returns {{ profilePlayerId: string|null, legacyPlayerId: string|null, aliasIds: string[], mismatchedAliases: boolean, ignoredPrimaryClaims: string[] }}
 */
export function collectLegacyAliases(row = {}, athleteId = null) {
  const profilePlayerId = normalizeId(
    row.profilePlayerId || row.profile_player_id || row.player_id
  );
  const explicitLegacy = normalizeId(
    row.legacyPlayerId ||
      row.legacy_player_id ||
      row.blobPlayerId ||
      row.blob_player_id ||
      row.localPlayerId ||
      row.local_player_id
  );

  const ignoredPrimaryClaims = [];
  const extras = [];

  // Legacy callers may put blob id on `id` / `playerId` / `player.id`.
  // Treat as aliases when they differ from athletes.id — never as pairingIdentityId.
  const claimedPrimaries = [
    normalizeId(row.pairingIdentityId),
    normalizeId(row.id),
    normalizeId(row.playerId),
    normalizeId(row.player?.id),
  ].filter(Boolean);

  for (const claim of claimedPrimaries) {
    if (athleteId && claim === athleteId) continue;
    if (athleteId && claim !== athleteId) {
      ignoredPrimaryClaims.push(claim);
    }
    if (!athleteId || claim !== athleteId) {
      extras.push(claim);
    }
  }

  const legacyPlayerId =
    explicitLegacy && explicitLegacy !== athleteId
      ? explicitLegacy
      : extras.find((id) => id !== profilePlayerId && id !== athleteId) || null;

  const aliasIds = [];
  for (const id of [profilePlayerId, legacyPlayerId, explicitLegacy, ...extras]) {
    if (!id || id === athleteId) continue;
    if (!aliasIds.includes(id)) aliasIds.push(id);
  }

  const mismatchedAliases = Boolean(
    profilePlayerId &&
      legacyPlayerId &&
      profilePlayerId !== legacyPlayerId
  );

  return {
    profilePlayerId:
      profilePlayerId && profilePlayerId !== athleteId ? profilePlayerId : null,
    legacyPlayerId:
      legacyPlayerId && legacyPlayerId !== athleteId ? legacyPlayerId : null,
    aliasIds,
    mismatchedAliases,
    ignoredPrimaryClaims: [...new Set(ignoredPrimaryClaims)],
  };
}

/**
 * Classify coverage bucket. Missing aliases → unmapped (eligible).
 * @param {{ profilePlayerId?: string|null, legacyPlayerId?: string|null }} aliases
 * @returns {"mapped"|"derived"|"unmapped"}
 */
export function classifyIdentityCoverage(aliases = {}) {
  if (aliases.profilePlayerId) return "mapped";
  if (aliases.legacyPlayerId || (aliases.aliasIds && aliases.aliasIds.length > 0)) {
    return "derived";
  }
  return "unmapped";
}

/**
 * @param {object} row
 * @returns {{
 *   ok: boolean,
 *   candidateSeed?: object,
 *   exclusion?: { athleteId: string|null, pairingIdentityId: string|null, reasonCode: string, details?: object },
 *   coverageBucket?: "mapped"|"derived"|"unmapped"
 * }}
 */
export function mapPairingIdentity(row = {}) {
  const athleteId = extractAthleteId(row);
  const userId = normalizeId(row.userId || row.user_id);
  const aliases = collectLegacyAliases(row, athleteId);

  if (!athleteId) {
    return {
      ok: false,
      exclusion: {
        athleteId: null,
        pairingIdentityId: null,
        reasonCode: PAIRING_CANDIDATE_REASON_CODES.MISSING_IDENTITY_LINK,
        details: {
          userId,
          membershipId: row.membershipId || row.membership_id || null,
          reason: "athletes.id missing",
          offeredAliases: aliases.aliasIds,
          ignoredPrimaryClaims: aliases.ignoredPrimaryClaims,
        },
      },
    };
  }

  // athletes.id always wins — discard conflicting pairingIdentityId / id claims.
  const pairingIdentityId = athleteId;
  const coverageBucket = classifyIdentityCoverage(aliases);
  const ratingFields = projectCanonicalRatingFields(row);

  return {
    ok: true,
    coverageBucket,
    candidateSeed: {
      athleteId,
      userId,
      pairingIdentityId,
      displayName: String(row.displayName || row.display_name || athleteId).trim(),
      gender: row.gender ?? null,
      rating: ratingFields.ratingValue,
      level: ratingFields.ratingValue,
      currentRating: ratingFields.currentRating,
      provisionalRating: ratingFields.provisionalRating,
      selfDeclaredRating: ratingFields.selfDeclaredRating,
      ratingValue: ratingFields.ratingValue,
      ratingLabel: ratingFields.ratingLabel,
      ratingSource: ratingFields.ratingSource,
      athleteStatus: String(row.athleteStatus || row.athlete_status || "active")
        .trim()
        .toLowerCase(),
      membershipId: row.membershipId || row.membership_id || null,
      membershipStatus: row.membershipStatus || row.membership_status || null,
      clubId: row.clubId || row.club_id || null,
      tenantId: row.tenantId || row.tenant_id || null,
      registrationStatus: row.registrationStatus || row.registration_status || null,
      metadata: {
        ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
        legacyPlayerId: aliases.legacyPlayerId,
        profilePlayerId: aliases.profilePlayerId,
        aliasIds: aliases.aliasIds,
        selectable: true,
        identity: {
          pairingIdentityId,
          accountUserId: userId,
          coverageBucket,
          mismatchedAliases: aliases.mismatchedAliases,
          ignoredPrimaryClaims: aliases.ignoredPrimaryClaims,
          athletesIdAlwaysWins: true,
        },
      },
    },
  };
}

/**
 * Build alias → athleteId index for resolving legacy lookups.
 * Duplicate aliases map to an array of athleteIds (callers must not silently collapse).
 *
 * @param {object[]} seeds
 * @returns {{
 *   byAthleteId: Map<string, object>,
 *   byAlias: Map<string, string[]>,
 *   duplicateAliases: Array<{ aliasId: string, athleteIds: string[] }>
 * }}
 */
export function buildPairingIdentityIndex(seeds = []) {
  const byAthleteId = new Map();
  const byAlias = new Map();

  for (const seed of seeds || []) {
    const athleteId = normalizeId(seed.athleteId || seed.pairingIdentityId);
    if (!athleteId) continue;
    byAthleteId.set(athleteId, seed);

    const aliasIds = [
      ...(Array.isArray(seed.metadata?.aliasIds) ? seed.metadata.aliasIds : []),
      seed.metadata?.profilePlayerId,
      seed.metadata?.legacyPlayerId,
    ]
      .map(normalizeId)
      .filter(Boolean);

    for (const aliasId of [...new Set(aliasIds)]) {
      if (aliasId === athleteId) continue;
      const owners = byAlias.get(aliasId) || [];
      if (!owners.includes(athleteId)) owners.push(athleteId);
      byAlias.set(aliasId, owners);
    }
  }

  const duplicateAliases = [];
  for (const [aliasId, athleteIds] of byAlias.entries()) {
    if (athleteIds.length > 1) {
      duplicateAliases.push({ aliasId, athleteIds: [...athleteIds] });
    }
  }

  return { byAthleteId, byAlias, duplicateAliases };
}

/**
 * Resolve any id (athlete / profile / blob) to pairingIdentityId (= athletes.id).
 * Prefer direct athletes.id hit. Never invent an id from an unknown alias.
 *
 * @param {string} anyId
 * @param {{ byAthleteId: Map, byAlias: Map }} index
 * @returns {{ ok: boolean, pairingIdentityId: string|null, via: "athlete"|"alias"|null, ambiguous?: boolean, athleteIds?: string[] }}
 */
export function resolvePairingIdentityId(anyId, index) {
  const id = normalizeId(anyId);
  if (!id || !index) {
    return { ok: false, pairingIdentityId: null, via: null };
  }
  if (index.byAthleteId?.has(id)) {
    return { ok: true, pairingIdentityId: id, via: "athlete" };
  }
  const owners = index.byAlias?.get(id) || [];
  if (owners.length === 1) {
    return { ok: true, pairingIdentityId: owners[0], via: "alias" };
  }
  if (owners.length > 1) {
    return {
      ok: false,
      pairingIdentityId: null,
      via: "alias",
      ambiguous: true,
      athleteIds: [...owners],
    };
  }
  return { ok: false, pairingIdentityId: null, via: null };
}

/**
 * Map many scope rows. Accumulates exclusions, coverage, and alias diagnostics.
 * Duplicate / mismatched aliases never drop an athlete that has athletes.id.
 *
 * @param {object[]} rows
 * @returns {{
 *   seeds: object[],
 *   excluded: object[],
 *   identityCoverage: { mapped: number, derived: number, unmapped: number },
 *   aliasDiagnostics: {
 *     duplicateAliases: Array<{ aliasId: string, athleteIds: string[] }>,
 *     mismatchedAliasCount: number,
 *     ignoredPrimaryClaimCount: number
 *   },
 *   warnings: string[]
 * }}
 */
export function mapPairingIdentities(rows = []) {
  const seeds = [];
  const excluded = [];
  const identityCoverage = emptyIdentityCoverage();
  let mismatchedAliasCount = 0;
  let ignoredPrimaryClaimCount = 0;

  for (const row of rows || []) {
    const mapped = mapPairingIdentity(row);
    if (!mapped.ok) {
      excluded.push(mapped.exclusion);
      continue;
    }
    identityCoverage[mapped.coverageBucket] += 1;
    if (mapped.candidateSeed.metadata?.identity?.mismatchedAliases) {
      mismatchedAliasCount += 1;
    }
    ignoredPrimaryClaimCount +=
      mapped.candidateSeed.metadata?.identity?.ignoredPrimaryClaims?.length || 0;
    seeds.push(mapped.candidateSeed);
  }

  const { duplicateAliases } = buildPairingIdentityIndex(seeds);
  const warnings = [];
  if (duplicateAliases.length > 0) {
    warnings.push(
      `duplicate_legacy_aliases:${duplicateAliases.length}`
    );
    for (const seed of seeds) {
      const aliasIds = seed.metadata?.aliasIds || [];
      const dups = duplicateAliases.filter((d) => aliasIds.includes(d.aliasId));
      if (dups.length > 0) {
        seed.metadata = {
          ...seed.metadata,
          identity: {
            ...(seed.metadata.identity || {}),
            duplicateAliases: dups,
          },
        };
      }
    }
  }
  if (mismatchedAliasCount > 0) {
    warnings.push(`mismatched_aliases:${mismatchedAliasCount}`);
  }
  if (ignoredPrimaryClaimCount > 0) {
    warnings.push(`ignored_legacy_primary_claims:${ignoredPrimaryClaimCount}`);
  }

  return {
    seeds,
    excluded,
    identityCoverage,
    aliasDiagnostics: {
      duplicateAliases,
      mismatchedAliasCount,
      ignoredPrimaryClaimCount,
    },
    warnings,
  };
}

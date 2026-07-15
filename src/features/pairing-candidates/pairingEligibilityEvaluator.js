/**
 * PHASE 45B.2 — Pure pairing eligibility evaluator.
 * Ordered pipeline only. Soft rules never exclude.
 */

import { PAIRING_CANDIDATE_REASON_CODES as RC } from "./pairingCandidateReasonCodes.js";

function normalizeId(value) {
  return String(value || "").trim();
}

function idSet(values) {
  const set = new Set();
  for (const value of values || []) {
    const id = normalizeId(value);
    if (id) set.add(id);
  }
  return set;
}

function candidateKeys(seed) {
  return [
    normalizeId(seed.pairingIdentityId),
    normalizeId(seed.athleteId),
    normalizeId(seed.userId),
    normalizeId(seed.metadata?.legacyPlayerId),
    normalizeId(seed.metadata?.profilePlayerId),
  ].filter(Boolean);
}

function inIdSet(seed, set) {
  if (!set || set.size === 0) return false;
  return candidateKeys(seed).some((key) => set.has(key));
}

function genderKey(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (raw === "m" || raw === "male" || raw === "nam") return "male";
  if (raw === "f" || raw === "female" || raw === "nữ" || raw === "nu") return "female";
  return raw;
}

/**
 * Evaluate one seed against query constraints.
 * Returns null when eligible, or an exclusion object.
 *
 * @param {object} seed
 * @param {object} query
 * @returns {object|null}
 */
export function evaluatePairingEligibility(seed, query = {}) {
  const athleteStatus = String(seed.athleteStatus || "").toLowerCase();
  if (athleteStatus && athleteStatus !== "active") {
    return {
      athleteId: seed.athleteId,
      pairingIdentityId: seed.pairingIdentityId,
      reasonCode: RC.ATHLETE_INACTIVE,
      details: { athleteStatus },
    };
  }

  const membershipStatusRaw = seed.membershipStatus;
  if (membershipStatusRaw == null || membershipStatusRaw === "") {
    return {
      athleteId: seed.athleteId,
      pairingIdentityId: seed.pairingIdentityId,
      reasonCode: RC.MISSING_MEMBERSHIP,
      details: { clubId: seed.clubId || query.clubId || null },
    };
  }

  const membershipStatus = String(membershipStatusRaw).toLowerCase();
  if (membershipStatus !== "active") {
    return {
      athleteId: seed.athleteId,
      pairingIdentityId: seed.pairingIdentityId,
      reasonCode: RC.MEMBERSHIP_INACTIVE,
      details: { membershipStatus },
    };
  }

  const scopeClubId = normalizeId(query.clubId);
  const seedClubId = normalizeId(seed.clubId);
  if (scopeClubId && seedClubId && scopeClubId !== seedClubId) {
    return {
      athleteId: seed.athleteId,
      pairingIdentityId: seed.pairingIdentityId,
      reasonCode: RC.WRONG_SCOPE,
      details: { expectedClubId: scopeClubId, actualClubId: seedClubId },
    };
  }

  const scopeTenantId = normalizeId(query.tenantId);
  const seedTenantId = normalizeId(seed.tenantId);
  if (scopeTenantId && seedTenantId && scopeTenantId !== seedTenantId) {
    return {
      athleteId: seed.athleteId,
      pairingIdentityId: seed.pairingIdentityId,
      reasonCode: RC.WRONG_SCOPE,
      details: { expectedTenantId: scopeTenantId, actualTenantId: seedTenantId },
    };
  }

  if (query.requireRegistration) {
    const reg = String(seed.registrationStatus || "").trim().toLowerCase();
    if (!reg) {
      return {
        athleteId: seed.athleteId,
        pairingIdentityId: seed.pairingIdentityId,
        reasonCode: RC.NOT_REGISTERED,
        details: { tournamentId: query.tournamentId || null },
      };
    }
    if (reg === "withdrawn" || reg === "rejected" || reg === "cancelled") {
      return {
        athleteId: seed.athleteId,
        pairingIdentityId: seed.pairingIdentityId,
        reasonCode: RC.WITHDRAWN,
        details: { registrationStatus: reg },
      };
    }
  } else {
    const reg = String(seed.registrationStatus || "").trim().toLowerCase();
    if (reg === "withdrawn" || reg === "rejected" || reg === "cancelled") {
      return {
        athleteId: seed.athleteId,
        pairingIdentityId: seed.pairingIdentityId,
        reasonCode: RC.WITHDRAWN,
        details: { registrationStatus: reg },
      };
    }
  }

  const genderMode = String(query.genderMode || query.eventType || "")
    .trim()
    .toLowerCase();
  if (genderMode && genderMode !== "any" && genderMode !== "mixed" && genderMode !== "open") {
    const required =
      genderMode === "men" || genderMode === "mens" || genderMode === "md" || genderMode === "ms"
        ? "male"
        : genderMode === "women" ||
            genderMode === "womens" ||
            genderMode === "wd" ||
            genderMode === "ws"
          ? "female"
          : genderMode;
    const actual = genderKey(seed.gender);
    if (!actual) {
      return {
        athleteId: seed.athleteId,
        pairingIdentityId: seed.pairingIdentityId,
        reasonCode: RC.MISSING_GENDER,
        details: { required },
      };
    }
    if (required === "male" || required === "female") {
      if (actual !== required) {
        return {
          athleteId: seed.athleteId,
          pairingIdentityId: seed.pairingIdentityId,
          reasonCode: RC.MISSING_GENDER,
          details: { required, actual },
        };
      }
    }
  }

  const ratingBand = query.ratingBand;
  if (ratingBand && typeof ratingBand === "object") {
    const hasMin = ratingBand.min != null && ratingBand.min !== "";
    const hasMax = ratingBand.max != null && ratingBand.max !== "";
    if (hasMin || hasMax) {
      const rating = Number(seed.rating);
      if (!Number.isFinite(rating)) {
        return {
          athleteId: seed.athleteId,
          pairingIdentityId: seed.pairingIdentityId,
          reasonCode: RC.MISSING_RATING,
          details: { ratingBand },
        };
      }
      if (hasMin && rating < Number(ratingBand.min)) {
        return {
          athleteId: seed.athleteId,
          pairingIdentityId: seed.pairingIdentityId,
          reasonCode: RC.MISSING_RATING,
          details: { rating, ratingBand },
        };
      }
      if (hasMax && rating > Number(ratingBand.max)) {
        return {
          athleteId: seed.athleteId,
          pairingIdentityId: seed.pairingIdentityId,
          reasonCode: RC.MISSING_RATING,
          details: { rating, ratingBand },
        };
      }
    }
  }

  const busy = idSet(query.busyPlayerIds);
  if (inIdSet(seed, busy)) {
    return {
      athleteId: seed.athleteId,
      pairingIdentityId: seed.pairingIdentityId,
      reasonCode: RC.BUSY,
      details: {},
    };
  }

  const assigned = idSet(query.assignedPlayerIds);
  if (inIdSet(seed, assigned)) {
    return {
      athleteId: seed.athleteId,
      pairingIdentityId: seed.pairingIdentityId,
      reasonCode: RC.ALREADY_ASSIGNED,
      details: { teamId: query.teamId || null },
    };
  }

  return null;
}

/**
 * Evaluate all seeds.
 *
 * @param {object[]} seeds
 * @param {object} query
 * @returns {{ candidates: object[], excluded: object[] }}
 */
export function evaluateAllPairingEligibility(seeds = [], query = {}) {
  const candidates = [];
  const excluded = [];
  for (const seed of seeds || []) {
    const exclusion = evaluatePairingEligibility(seed, query);
    if (exclusion) excluded.push(exclusion);
    else candidates.push(seed);
  }
  return { candidates, excluded };
}

/**
 * Optional private-pairing seam. Soft scores never exclude.
 * Hard failures attach HARD_RULE_FAILED; fatal/policy return blocked status payload.
 *
 * @param {object[]} candidates
 * @param {object} [ruleResult]
 * @returns {{
 *   candidates: object[],
 *   excluded: object[],
 *   status?: string,
 *   softScores?: object,
 *   error?: object
 * }}
 */
export function applyOptionalPrivatePairingSeam(candidates = [], ruleResult = null) {
  if (!ruleResult || typeof ruleResult !== "object") {
    return { candidates, excluded: [] };
  }

  if (ruleResult.policyBlocked) {
    return {
      candidates: [],
      excluded: candidates.map((c) => ({
        athleteId: c.athleteId,
        pairingIdentityId: c.pairingIdentityId,
        reasonCode: RC.POLICY_BLOCKED,
        details: ruleResult.details || {},
      })),
      status: "blocked",
      error: {
        code: RC.POLICY_BLOCKED,
        message: String(ruleResult.message || "Private pairing blocked by policy."),
      },
    };
  }

  if (ruleResult.fatalConflicts) {
    return {
      candidates: [],
      excluded: candidates.map((c) => ({
        athleteId: c.athleteId,
        pairingIdentityId: c.pairingIdentityId,
        reasonCode: RC.FATAL_RULE_CONFLICT,
        details: ruleResult.details || {},
      })),
      status: "blocked",
      error: {
        code: RC.FATAL_RULE_CONFLICT,
        message: String(ruleResult.message || "Fatal private pairing rule conflict."),
      },
    };
  }

  const hardReject = idSet(ruleResult.hardRejectIds || ruleResult.rejectedIds);
  const remaining = [];
  const excluded = [];
  for (const c of candidates) {
    if (inIdSet(c, hardReject)) {
      excluded.push({
        athleteId: c.athleteId,
        pairingIdentityId: c.pairingIdentityId,
        reasonCode: RC.HARD_RULE_FAILED,
        details: {},
      });
    } else {
      const scored = { ...c };
      if (ruleResult.softScores && typeof ruleResult.softScores === "object") {
        const score =
          ruleResult.softScores[c.pairingIdentityId] ??
          ruleResult.softScores[c.athleteId] ??
          null;
        if (score != null) {
          scored.metadata = { ...scored.metadata, softScore: score };
        }
      }
      remaining.push(scored);
    }
  }

  return {
    candidates: remaining,
    excluded,
    softScores: ruleResult.softScores || undefined,
  };
}

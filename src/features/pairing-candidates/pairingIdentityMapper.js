/**
 * PHASE 45B.2 — Pairing identity mapper.
 *
 * pairingIdentityId = athletes.id (primary).
 * profilePlayerId / legacyPlayerId are aliases only (not SSOT).
 *
 * Identity coverage:
 * - mapped   = athleteId present AND profiles.player_id alias present
 * - derived  = athleteId present AND no profilePlayerId, but legacyPlayerId present
 * - unmapped = athleteId present AND neither alias
 *
 * Missing athleteId → MISSING_IDENTITY_LINK (never silent drop).
 */

import { PAIRING_CANDIDATE_REASON_CODES } from "./pairingCandidateReasonCodes.js";
import { emptyIdentityCoverage } from "./pairingCandidateContract.js";

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
  const athleteId = String(row.athleteId || row.athlete_id || "").trim() || null;
  const userId = String(row.userId || row.user_id || "").trim() || null;
  const profilePlayerId =
    String(row.profilePlayerId || row.profile_player_id || row.player_id || "").trim() || null;
  const legacyPlayerId =
    String(row.legacyPlayerId || row.legacy_player_id || "").trim() || null;

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
        },
      },
    };
  }

  let coverageBucket = "unmapped";
  if (profilePlayerId) coverageBucket = "mapped";
  else if (legacyPlayerId) coverageBucket = "derived";

  return {
    ok: true,
    coverageBucket,
    candidateSeed: {
      athleteId,
      userId,
      pairingIdentityId: athleteId,
      displayName: String(row.displayName || row.display_name || athleteId).trim(),
      gender: row.gender ?? null,
      rating: row.rating ?? row.level ?? null,
      athleteStatus: String(row.athleteStatus || row.athlete_status || "active")
        .trim()
        .toLowerCase(),
      membershipId: row.membershipId || row.membership_id || null,
      membershipStatus: row.membershipStatus || row.membership_status || null,
      clubId: row.clubId || row.club_id || null,
      tenantId: row.tenantId || row.tenant_id || null,
      registrationStatus: row.registrationStatus || row.registration_status || null,
      metadata: {
        legacyPlayerId,
        profilePlayerId,
        selectable: true,
        ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
      },
    },
  };
}

/**
 * Map many scope rows. Accumulates exclusions and identity coverage.
 *
 * @param {object[]} rows
 * @returns {{ seeds: object[], excluded: object[], identityCoverage: object }}
 */
export function mapPairingIdentities(rows = []) {
  const seeds = [];
  const excluded = [];
  const identityCoverage = emptyIdentityCoverage();

  for (const row of rows || []) {
    const mapped = mapPairingIdentity(row);
    if (!mapped.ok) {
      excluded.push(mapped.exclusion);
      continue;
    }
    identityCoverage[mapped.coverageBucket] += 1;
    seeds.push(mapped.candidateSeed);
  }

  return { seeds, excluded, identityCoverage };
}

/**
 * PHASE 45B.3 — Canonical Athlete repository for pairing scope reads.
 *
 * Athlete SSOT: public.athletes (via injectable loaders — no SQL in this phase).
 * Membership SSOT: public.club_members.
 *
 * Identity: athletes.id is the only pairing primary. profiles.player_id /
 * blob player ids are stored as aliases on the scope row only.
 *
 * No blob or browser storage. No writes. Dependency-injected for unit tests.
 *
 * Why a dedicated repository (not extending canonicalPlayerRepository):
 * - Player repository keys on profiles.player_id ↔ blob playerId.
 * - Pairing gateway keys on athletes.id and must never import blob storage.
 */

import {
  projectCanonicalRatingFields,
} from "./canonicalAthleteRating.js";

function normalizeId(value) {
  return String(value || "").trim();
}

function normalizeStatus(value, fallback = null) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  return raw || fallback;
}

/**
 * Normalize a joined Athlete+Membership scope row.
 * @param {object} partial
 */
export function normalizeAthleteMembershipScopeRow(partial = {}) {
  // Never promote player_id / blob id / row.id into athleteId.
  const athleteId = normalizeId(partial.athleteId || partial.athlete_id) || null;
  const profilePlayerId =
    normalizeId(partial.profilePlayerId || partial.profile_player_id || partial.player_id) ||
    null;
  const legacyPlayerId =
    normalizeId(
      partial.legacyPlayerId ||
        partial.legacy_player_id ||
        partial.blobPlayerId ||
        partial.localPlayerId
    ) || null;

  const canonical = projectCanonicalRatingFields({
    currentRating: partial.currentRating ?? partial.current_rating,
    provisionalRating: partial.provisionalRating ?? partial.provisional_rating,
    selfDeclaredRating: partial.selfDeclaredRating ?? partial.self_declared_rating,
    ratingValue: partial.ratingValue,
    ratingLabel: partial.ratingLabel,
    ratingSource: partial.ratingSource,
    rating: partial.rating,
    level: partial.level,
    skillLevel: partial.skillLevel ?? partial.skill_level,
  });

  return {
    athleteId,
    userId: normalizeId(partial.userId || partial.user_id) || null,
    displayName: String(
      partial.displayName || partial.display_name || partial.name || ""
    ).trim(),
    gender: partial.gender ?? null,
    rating: canonical.ratingValue,
    level: canonical.ratingValue,
    currentRating: canonical.currentRating,
    provisionalRating: canonical.provisionalRating,
    selfDeclaredRating: canonical.selfDeclaredRating,
    ratingValue: canonical.ratingValue,
    ratingLabel: canonical.ratingLabel,
    ratingSource: canonical.ratingSource,
    athleteStatus: normalizeStatus(partial.athleteStatus || partial.athlete_status, "active"),
    membershipId: normalizeId(partial.membershipId || partial.membership_id) || null,
    membershipStatus:
      partial.membershipStatus == null && partial.membership_status == null
        ? null
        : normalizeStatus(partial.membershipStatus || partial.membership_status),
    clubId: normalizeId(partial.clubId || partial.club_id) || null,
    tenantId: normalizeId(partial.tenantId || partial.tenant_id) || null,
    profilePlayerId:
      profilePlayerId && profilePlayerId !== athleteId ? profilePlayerId : null,
    legacyPlayerId:
      legacyPlayerId && legacyPlayerId !== athleteId ? legacyPlayerId : null,
    registrationStatus: partial.registrationStatus || partial.registration_status || null,
  };
}

/**
 * Join athlete + membership rows in memory (read-only).
 *
 * @param {object} input
 * @param {object[]} [input.athletes]
 * @param {object[]} [input.memberships]
 * @param {object} [input.scope]
 * @returns {{ rows: object[], athleteRows: number, membershipRows: number, activeMembershipRows: number }}
 */
export function joinAthletesAndMemberships({ athletes = [], memberships = [], scope = {} } = {}) {
  const clubId = normalizeId(scope.clubId);
  const tenantId = normalizeId(scope.tenantId);

  const membershipByUser = new Map();
  const membershipByAthlete = new Map();
  let membershipRows = 0;
  let activeMembershipRows = 0;

  for (const raw of memberships || []) {
    const club = normalizeId(raw.clubId || raw.club_id);
    if (clubId && club && club !== clubId) continue;
    membershipRows += 1;
    const status = normalizeStatus(raw.status || raw.membershipStatus || raw.membership_status);
    if (status === "active") activeMembershipRows += 1;

    const row = {
      membershipId: normalizeId(raw.id || raw.membershipId || raw.membership_id) || null,
      membershipStatus: status,
      userId: normalizeId(raw.userId || raw.user_id) || null,
      athleteId: normalizeId(raw.athleteId || raw.athlete_id) || null,
      clubId: club || clubId || null,
      tenantId: normalizeId(raw.tenantId || raw.tenant_id) || tenantId || null,
    };
    if (row.userId) membershipByUser.set(row.userId, row);
    if (row.athleteId) membershipByAthlete.set(row.athleteId, row);
  }

  const rows = [];
  const seenAthletes = new Set();

  for (const athlete of athletes || []) {
    const athleteId = normalizeId(athlete.id || athlete.athleteId || athlete.athlete_id);
    const userId = normalizeId(athlete.userId || athlete.user_id);
    if (athleteId) seenAthletes.add(athleteId);

    const membership =
      (athleteId && membershipByAthlete.get(athleteId)) ||
      (userId && membershipByUser.get(userId)) ||
      null;

    rows.push(
      normalizeAthleteMembershipScopeRow({
        athleteId,
        userId,
        displayName: athlete.displayName || athlete.display_name || athlete.name,
        gender: athlete.gender,
        rating: athlete.rating ?? athlete.level,
        athleteStatus: athlete.status || athlete.athleteStatus,
        membershipId: membership?.membershipId ?? null,
        membershipStatus: membership ? membership.membershipStatus : null,
        clubId: membership?.clubId || clubId || null,
        tenantId: membership?.tenantId || athlete.tenantId || athlete.tenant_id || tenantId || null,
        profilePlayerId: athlete.profilePlayerId || athlete.player_id,
        legacyPlayerId: athlete.legacyPlayerId,
        registrationStatus: athlete.registrationStatus,
      })
    );
  }

  // Membership rows whose athlete was not in the athlete directory still surface
  // (athleteId may be null → MISSING_IDENTITY_LINK later).
  for (const raw of memberships || []) {
    const club = normalizeId(raw.clubId || raw.club_id);
    if (clubId && club && club !== clubId) continue;
    const athleteId = normalizeId(raw.athleteId || raw.athlete_id);
    if (athleteId && seenAthletes.has(athleteId)) continue;
    const userId = normalizeId(raw.userId || raw.user_id);
    rows.push(
      normalizeAthleteMembershipScopeRow({
        athleteId: athleteId || null,
        userId,
        displayName: raw.displayName || raw.display_name || "",
        gender: raw.gender,
        rating: raw.rating,
        athleteStatus: "active",
        membershipId: raw.id || raw.membershipId,
        membershipStatus: raw.status || raw.membershipStatus,
        clubId: club || clubId || null,
        tenantId: raw.tenantId || raw.tenant_id || tenantId || null,
        profilePlayerId: raw.player_id || raw.profilePlayerId,
        legacyPlayerId: raw.legacyPlayerId,
        registrationStatus: raw.registrationStatus,
      })
    );
  }

  return {
    rows,
    athleteRows: (athletes || []).length,
    membershipRows,
    activeMembershipRows,
  };
}

/**
 * @param {object} [deps]
 * @param {(scope: object) => Promise<object>|object} [deps.listScopeRows]
 *   Optional full override returning { ok, rows, error?, sourceBreakdown? }
 * @param {(scope: object) => Promise<object[]>|object[]} [deps.loadAthletes]
 * @param {(scope: object) => Promise<object[]>|object[]} [deps.loadMemberships]
 */
export function createCanonicalAthleteRepository(deps = {}) {
  const { listScopeRows = null, loadAthletes = null, loadMemberships = null } = deps;

  /**
   * @param {object} scope
   * @returns {Promise<{ ok: boolean, rows?: object[], error?: object, sourceBreakdown?: object }>}
   */
  async function listInScope(scope = {}) {
    const clubId = normalizeId(scope.clubId);
    if (!clubId) {
      return {
        ok: false,
        error: {
          code: "WRONG_SCOPE",
          message: "clubId is required for pairing athlete scope.",
        },
        rows: [],
        sourceBreakdown: {
          athleteRows: 0,
          membershipRows: 0,
          activeMembershipRows: 0,
        },
      };
    }

    try {
      if (typeof listScopeRows === "function") {
        const result = await listScopeRows(scope);
        if (!result || result.ok === false) {
          return {
            ok: false,
            error: result?.error || {
              code: "REPOSITORY_ERROR",
              message: "Scope row loader failed.",
            },
            rows: [],
            sourceBreakdown: result?.sourceBreakdown || {
              athleteRows: 0,
              membershipRows: 0,
              activeMembershipRows: 0,
            },
          };
        }
        const rows = (result.rows || []).map(normalizeAthleteMembershipScopeRow);
        return {
          ok: true,
          rows,
          sourceBreakdown: {
            athleteRows: result.sourceBreakdown?.athleteRows ?? rows.length,
            membershipRows: result.sourceBreakdown?.membershipRows ?? 0,
            activeMembershipRows: result.sourceBreakdown?.activeMembershipRows ?? 0,
            registeredRows: result.sourceBreakdown?.registeredRows,
          },
        };
      }

      if (typeof loadAthletes !== "function" || typeof loadMemberships !== "function") {
        return {
          ok: false,
          error: {
            code: "REPOSITORY_NOT_CONFIGURED",
            message:
              "canonicalAthleteRepository requires listScopeRows or loadAthletes+loadMemberships injectables.",
          },
          rows: [],
          sourceBreakdown: {
            athleteRows: 0,
            membershipRows: 0,
            activeMembershipRows: 0,
          },
        };
      }

      const athletes = await loadAthletes(scope);
      const memberships = await loadMemberships(scope);
      const joined = joinAthletesAndMemberships({
        athletes: Array.isArray(athletes) ? athletes : [],
        memberships: Array.isArray(memberships) ? memberships : [],
        scope,
      });

      return {
        ok: true,
        rows: joined.rows,
        sourceBreakdown: {
          athleteRows: joined.athleteRows,
          membershipRows: joined.membershipRows,
          activeMembershipRows: joined.activeMembershipRows,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: "REPOSITORY_ERROR",
          message: String(err?.message || err || "Repository failure"),
        },
        rows: [],
        sourceBreakdown: {
          athleteRows: 0,
          membershipRows: 0,
          activeMembershipRows: 0,
        },
      };
    }
  }

  return {
    listInScope,
    // Explicit read-only surface — no mutators.
  };
}

export const canonicalAthleteRepository = createCanonicalAthleteRepository();

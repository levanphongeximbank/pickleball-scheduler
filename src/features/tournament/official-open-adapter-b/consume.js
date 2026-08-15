/**
 * Sync Official/Open consumers of canonical Identity evidence.
 * Uses the same Identity matrix as competition.identity-access.adapter.v1.
 * Does not create a second RBAC engine. Auth/session stay on Identity.
 */

import { createIdentityPermissionResolver } from "../../competition-engine/integration/adapters/identityEvidenceFromIdentityAdapter.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { isOfficialOpenTournament } from "./activation.js";

const resolveGranted = createIdentityPermissionResolver();

export function isOfficialOpenManageTarget(tournament) {
  return (
    isOfficialOpenTournament(tournament) ||
    String(tournament?.mode || "") === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT
  );
}

/**
 * @param {{
 *   actor?: { id?: string, role?: string }|null,
 *   tenantId?: string|null,
 *   clubId?: string|null,
 *   venueId?: string|null,
 *   competitionId?: string|null,
 *   rbacEnabled?: boolean,
 * }} input
 */
export function evaluateOfficialOpenManageAccess(input = {}) {
  if (input.rbacEnabled === false) {
    return { ok: true, allowed: true, skipped: true, reason: "RBAC_DISABLED" };
  }
  const actorId = input.actor?.id ? String(input.actor.id).trim() : "";
  const role = input.actor?.role ? String(input.actor.role).trim() : "";
  const tenantId = input.tenantId ? String(input.tenantId).trim() : "";
  if (!actorId || !role || !tenantId) {
    return {
      ok: false,
      allowed: false,
      code: "MISSING_REQUIRED_CONTEXT",
      error: "Official/Open manage access requires actor, role, and tenantId.",
    };
  }
  try {
    const granted = resolveGranted({
      subject: { actorId, role },
      scope: {
        tenantId,
        clubId: input.clubId || null,
        venueId: input.venueId || null,
        competitionId: input.competitionId || null,
      },
    });
    const allowed = Array.isArray(granted) && granted.includes(PERMISSIONS.TOURNAMENT_UPDATE);
    return { ok: true, allowed, grantedPermissions: granted };
  } catch (err) {
    return {
      ok: false,
      allowed: false,
      code: err?.code || "IDENTITY_EVIDENCE_FAILED",
      error: err instanceof Error ? err.message : String(err || "identity evidence failed"),
    };
  }
}

export function buildOfficialOpenEligibilityOptions(tournament, base = {}, adapter = null) {
  const membershipRequired = Boolean(
    tournament?.settings?.eligibilityRules?.clubMembership?.enabled
  );
  return {
    ...base,
    requireCanonicalMembershipEvidence: membershipRequired,
    requireCanonicalRatingEvidence: Boolean(base.ratingEvidence),
    officialOpenAdapter: adapter,
  };
}

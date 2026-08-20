/**
 * Wave 4 — canonical Identity-domain Actor projection.
 *
 * subjectId = auth.uid = profiles.id
 * tenantId = profiles.tenant_id ONLY (never invented from venueId)
 * venueId = profiles.venue_id ONLY (home/default Venue)
 * missing status never becomes ACTIVE
 *
 * Not implemented in Competition. Platform Core must not import this from
 * Contract #01. Login / Auth runtime is the consumer.
 */

import { normalizeUser, USER_STATUS } from "../../../models/user.js";
import { normalizeRole } from "../constants/roles.js";
import { normalizeProfileGender } from "../utils/profileGender.js";

export const IDENTITY_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  INCOMPLETE: "INCOMPLETE",
});

function trimId(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function resolveIdentityStatus(status) {
  const raw = String(status ?? "").trim();
  if (!raw) {
    return IDENTITY_STATUS.INCOMPLETE;
  }
  if (raw === USER_STATUS.ACTIVE || raw.toLowerCase() === "active") {
    return IDENTITY_STATUS.ACTIVE;
  }
  return IDENTITY_STATUS.INACTIVE;
}

/**
 * Map a public.profiles row to the canonical application Actor.
 * Does not read JWT metadata. Does not invent tenantId from venueId.
 */
export function projectCanonicalActorFromProfileRow(row, extra = {}) {
  if (!row) {
    return null;
  }

  const subjectId = trimId(row.id);
  const tenantId = trimId(row.tenant_id ?? row.tenantId);
  const venueId = trimId(row.venue_id ?? row.venueId);
  const identityStatus = resolveIdentityStatus(row.status);
  const incomplete = identityStatus === IDENTITY_STATUS.INCOMPLETE;

  return normalizeUser({
    id: subjectId,
    email: row.email,
    displayName: row.display_name || row.displayName || "",
    role: normalizeRole(row.role),
    tenantId,
    venueId,
    clubId: trimId(row.club_id ?? row.clubId),
    playerId: trimId(row.player_id ?? row.playerId),
    tournamentId: trimId(row.tournament_id ?? row.tournamentId),
    teamId: trimId(row.team_id ?? row.teamId),
    phone: row.phone || "",
    avatarUrl: row.avatar_url || row.avatarUrl || "",
    gender: normalizeProfileGender(row.gender) || "",
    birthYear: row.birth_year ?? row.birthYear ?? null,
    status: incomplete ? "" : String(row.status).trim(),
    identityIncomplete: incomplete,
    identityStatus,
    mustChangePassword: Boolean(row.must_change_password ?? row.mustChangePassword),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignedClusterIds: extra.assignedClusterIds,
    entitlementEvidence: extra.entitlementEvidence || null,
  });
}

export function isCanonicalActorComplete(actor) {
  if (!actor?.id) {
    return false;
  }
  if (actor.identityIncomplete || actor.identityStatus === IDENTITY_STATUS.INCOMPLETE) {
    return false;
  }
  if (!actor.role) {
    return false;
  }
  return true;
}

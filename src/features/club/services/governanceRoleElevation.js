import { ROLES, normalizeRole } from "../../../auth/roles.js";
import { normalizeUser } from "../../../models/user.js";
import { rpcAdminUpdateUser } from "../../identity/services/identityRpcService.js";
import { getVicePresidentUserIds } from "../models/clubGovernance.js";
import { loadAthleteClubLink } from "../storage/athleteClubLinkStore.js";
import {
  hasClubGovernanceManagerAccess,
  resolveGovernanceElevatedRole,
} from "../../../auth/governanceScopeResolver.js";

// Phase 44C.1A — canonical governance elevation is owned by governanceScopeResolver
// (the single authorization-layer place allowed to read the local club registry).
// Re-exported here so existing importers keep working; this file no longer reads
// the registry (loadClubs/getClubById) for a governance authorization decision.
export { hasClubGovernanceManagerAccess, resolveGovernanceElevatedRole };

function sameUserId(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

export function isClubPresident(user, club) {
  if (!user?.id || !club?.governance?.presidentUserId) {
    return false;
  }
  return sameUserId(user.id, club.governance.presidentUserId);
}

export function isClubVicePresident(user, club) {
  if (!user?.id) {
    return false;
  }
  return getVicePresidentUserIds(club?.governance).some((id) => sameUserId(user.id, id));
}

function shouldRetainClubManagerRole(userId, governance) {
  if (!userId || !governance) {
    return false;
  }

  if (sameUserId(userId, governance.presidentUserId)) {
    return true;
  }

  if (sameUserId(userId, governance.ownerUserId)) {
    return true;
  }

  return getVicePresidentUserIds(governance).some((id) => sameUserId(userId, id));
}

/** Session bootstrap — promote PLAYER → CLUB_MANAGER khi governance yêu cầu. */
export function syncGovernanceAuthRoleFromClub(user) {
  if (!user?.id) {
    return { user, changed: false };
  }

  const role = normalizeRole(user.role);
  if (role !== ROLES.PLAYER) {
    return { user, changed: false };
  }

  if (!hasClubGovernanceManagerAccess(user)) {
    return { user, changed: false };
  }

  const clubId = user.clubId || user.club_id;
  const link = loadAthleteClubLink(user.id);
  const nextUser = normalizeUser({
    ...user,
    role: ROLES.CLUB_MANAGER,
    clubId,
    playerId: user.playerId || user.player_id || link?.playerId || null,
  });

  void rpcAdminUpdateUser(user.id, {
    clubId,
    role: ROLES.CLUB_MANAGER,
  });

  return { user: nextUser, changed: true };
}

export function promoteGovernanceAthleteRole(clubId, userId, candidate = null) {
  const trimmed = String(userId || "").trim();
  if (!trimmed || !clubId) {
    return;
  }

  void rpcAdminUpdateUser(trimmed, {
    clubId,
    role: ROLES.CLUB_MANAGER,
  });

  return {
    clubId,
    userId: trimmed,
    playerId: candidate?.playerId || loadAthleteClubLink(trimmed)?.playerId || null,
    role: ROLES.CLUB_MANAGER,
  };
}

export function demoteGovernanceAthleteRole(clubId, userId, governance) {
  const trimmed = String(userId || "").trim();
  if (!trimmed || shouldRetainClubManagerRole(trimmed, governance)) {
    return null;
  }

  void rpcAdminUpdateUser(trimmed, {
    clubId: clubId || null,
    role: ROLES.PLAYER,
  });

  return {
    clubId: clubId || null,
    userId: trimmed,
    role: ROLES.PLAYER,
  };
}

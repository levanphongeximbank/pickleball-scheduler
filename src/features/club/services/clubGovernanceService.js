import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import {
  ROLES,
  isClubScopedRole,
  isGlobalRole,
  isVenueScopedRole,
  normalizeRole,
} from "../../../auth/roles.js";
import { getClubById as getRegistryClubById, updateClubMeta } from "../../../domain/clubService.js";
import { guardClubAction, guardPermission } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { CLUB_STATUSES } from "../constants/clubStatus.js";
import { hasClubPresident, normalizeClubGovernance } from "../models/clubGovernance.js";
import { loadCourtsForVenueScoped } from "../../../domain/courtService.js";

function sameUserId(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

export function isClubOwner(user, club) {
  if (!user?.id || !club?.governance?.ownerUserId) {
    return false;
  }
  return sameUserId(user.id, club.governance.ownerUserId);
}

export function isClubPresident(user, club) {
  if (!user?.id || !club?.governance?.presidentUserId) {
    return false;
  }
  return sameUserId(user.id, club.governance.presidentUserId);
}

export function isClubVicePresident(user, club) {
  if (!user?.id || !club?.governance?.vicePresidentUserId) {
    return false;
  }
  return sameUserId(user.id, club.governance.vicePresidentUserId);
}

export function canViewFullClubMembers(user, club) {
  if (!club) {
    return false;
  }

  if (!isRbacEnabled() || !user) {
    return true;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  if (isClubPresident(user, club) || isClubVicePresident(user, club) || isClubOwner(user, club)) {
    return true;
  }

  if (isClubScopedRole(user.role) && user.clubId === club.id) {
    return true;
  }

  if (isVenueScopedRole(user.role)) {
    return isClubOwner(user, club);
  }

  return false;
}

export function canViewClubMemberSummary(user, club) {
  if (!club || !isRbacEnabled() || !user) {
    return false;
  }

  if (canViewFullClubMembers(user, club)) {
    return false;
  }

  if (isGlobalRole(user.role)) {
    return false;
  }

  return isVenueScopedRole(user.role);
}

export function canAssignClubOwner(user) {
  if (!isRbacEnabled() || !user) {
    return true;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  return normalizeRole(user.role) === ROLES.TENANT_OWNER;
}

export function canDeleteClubMembers(user, club) {
  if (!canViewFullClubMembers(user, club)) {
    return false;
  }

  if (isClubVicePresident(user, club)) {
    return false;
  }

  return true;
}

export function canManageClubGovernance(user, club) {
  if (!club) {
    return false;
  }

  if (!isRbacEnabled() || !user) {
    return true;
  }

  if (isGlobalRole(user.role)) {
    return true;
  }

  return isClubPresident(user, club) || isClubOwner(user, club) || canAssignClubOwner(user);
}

export function canApproveClubRegistration(user, club) {
  if (!club || club.status !== CLUB_STATUSES.PENDING_APPROVAL) {
    return false;
  }

  if (!isRbacEnabled() || !user) {
    return true;
  }

  return canAssignClubOwner(user);
}

export function resolveGovernanceForCreate(data = {}, user = getCurrentUser()) {
  const governance = normalizeClubGovernance(data.governance || data, {});

  let presidentUserId = governance.presidentUserId;
  if (!presidentUserId && user && isClubScopedRole(user.role)) {
    presidentUserId = user.id;
  }

  let ownerUserId = governance.ownerUserId;
  const isCourtOwnerCreate =
    user && normalizeRole(user.role) === ROLES.TENANT_OWNER;
  const isClubManagerSelfRegister =
    user &&
    isClubScopedRole(user.role) &&
    normalizeRole(user.role) === ROLES.CLUB_MANAGER;

  if (ownerUserId == null && isCourtOwnerCreate) {
    if (data.assignOwnerToCreator !== false) {
      ownerUserId = user.id;
    }
  }

  const nextGovernance = {
    ...governance,
    presidentUserId: presidentUserId || null,
    ownerUserId: ownerUserId ?? null,
  };

  let status = CLUB_STATUSES.PENDING_SETUP;
  if (hasClubPresident(nextGovernance)) {
    if (data.submitForApproval || (isClubManagerSelfRegister && !isCourtOwnerCreate)) {
      status = CLUB_STATUSES.PENDING_APPROVAL;
    } else {
      status = CLUB_STATUSES.ACTIVE;
    }
  }

  return { governance: nextGovernance, status };
}

export function assignClubOwner(clubId, ownerUserId, tenantId) {
  const user = getCurrentUser();
  if (!canAssignClubOwner(user)) {
    return { ok: false, error: "Chỉ chủ sân hoặc quản trị hệ thống được gán Chủ sở hữu CLB." };
  }

  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  const check = guardPermission(PERMISSIONS.CLUB_GOVERNANCE_ASSIGN_OWNER, {
    venueId: tenantId || club.venueId,
    tenantId: tenantId || club.tenantId,
    clubId,
  });
  if (!check.ok) {
    return check;
  }

  const trimmed = ownerUserId ? String(ownerUserId).trim() : null;
  const governance = {
    ...club.governance,
    ownerUserId: trimmed,
  };

  return updateClubMeta(clubId, { governance });
}

export function approveClubRegistration(clubId, tenantId) {
  const user = getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canApproveClubRegistration(user, club)) {
    return { ok: false, error: "Chỉ chủ sân được duyệt CLB đăng ký." };
  }

  const check = guardPermission(PERMISSIONS.CLUB_GOVERNANCE_APPROVE, {
    venueId: tenantId || club.venueId,
    tenantId: tenantId || club.tenantId,
    clubId,
  });
  if (!check.ok) {
    return check;
  }

  if (!hasClubPresident(club.governance)) {
    return { ok: false, error: "CLB chưa có Chủ tịch — không thể duyệt." };
  }

  const now = new Date().toISOString();
  return updateClubMeta(clubId, {
    status: CLUB_STATUSES.ACTIVE,
    governance: {
      ...club.governance,
      approvedByUserId: user?.id || null,
      approvedAt: now,
    },
  });
}

export function rejectClubRegistration(clubId, tenantId) {
  const user = getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canApproveClubRegistration(user, club)) {
    return { ok: false, error: "Chỉ chủ sân được từ chối CLB đăng ký." };
  }

  return updateClubMeta(clubId, { status: CLUB_STATUSES.INACTIVE });
}

export function getRegisteredCourtsLabels(club, tenantId) {
  const ids = new Set(club?.governance?.registeredCourtIds || []);
  if (!ids.size || !tenantId) {
    return [];
  }

  const courts = loadCourtsForVenueScoped(tenantId, tenantId);
  return courts
    .filter((court) => ids.has(court.id))
    .map((court) => ({
      id: court.id,
      name: court.name || court.id,
      clubName: court.clubName,
    }));
}

export function updateClubGovernance(clubId, patch = {}) {
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  const user = getCurrentUser();
  const canAssignOwner = canAssignClubOwner(user);
  const canManage = canManageClubGovernance(user, club);

  if (patch.ownerUserId !== undefined && !canAssignOwner) {
    return { ok: false, error: "Không có quyền gán Chủ sở hữu CLB." };
  }

  if (
    (patch.presidentUserId !== undefined ||
      patch.vicePresidentUserId !== undefined ||
      patch.registeredCourtIds !== undefined) &&
    !canManage
  ) {
    return { ok: false, error: "Không có quyền cập nhật quản trị CLB." };
  }

  const check = guardClubAction(clubId, PERMISSIONS.CLUB_UPDATE);
  if (!check.ok) {
    return check;
  }

  const merged = normalizeClubGovernance(
    {
      ...club.governance,
      ...patch,
    },
    club
  );

  let status = club.status;
  if (patch.presidentUserId !== undefined) {
    if (hasClubPresident(merged) && club.status === CLUB_STATUSES.PENDING_SETUP) {
      status = CLUB_STATUSES.ACTIVE;
    }
    if (!hasClubPresident(merged)) {
      status = CLUB_STATUSES.PENDING_SETUP;
    }
  }
  if (patch.status !== undefined) {
    status = patch.status;
  }
  return updateClubMeta(clubId, {
    governance: merged,
    status,
  });
}

export function getGovernanceDisplayLabels(club) {
  const gov = club?.governance || {};
  const ownerLabel = gov.ownerUserId ? gov.ownerUserId : "Chưa gán";
  const presidentLabel = gov.presidentUserId ? gov.presidentUserId : "Chưa gán";
  const viceLabel = gov.vicePresidentUserId ? gov.vicePresidentUserId : "—";

  if (
    gov.ownerUserId &&
    gov.presidentUserId &&
    sameUserId(gov.ownerUserId, gov.presidentUserId)
  ) {
    return {
      ownerLabel: `${presidentLabel} (Chủ sở hữu & Chủ tịch)`,
      presidentLabel: null,
      vicePresidentLabel: viceLabel,
      combinedOwnerPresident: true,
    };
  }

  return {
    ownerLabel,
    presidentLabel,
    vicePresidentLabel: viceLabel,
    combinedOwnerPresident: false,
  };
}

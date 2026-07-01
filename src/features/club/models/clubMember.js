import {
  CLUB_MEMBER_ROLES,
  CLUB_MEMBER_STATUSES,
} from "../constants/clubMemberRoles.js";

export function normalizeClubMember(member) {
  const id = String(member?.id || "").trim();
  const clubId = String(member?.clubId || "").trim();
  const playerId = String(member?.playerId || "").trim();
  const tenantId = String(member?.tenantId || "").trim();

  const role = Object.values(CLUB_MEMBER_ROLES).includes(member?.role)
    ? member.role
    : CLUB_MEMBER_ROLES.MEMBER;

  const status = Object.values(CLUB_MEMBER_STATUSES).includes(member?.status)
    ? member.status
    : CLUB_MEMBER_STATUSES.ACTIVE;

  return {
    id: id || `cm-${clubId}-${playerId}-${Date.now()}`,
    tenantId,
    clubId,
    playerId,
    role,
    status,
    joinedAt: member?.joinedAt || new Date().toISOString(),
    leftAt: member?.leftAt || null,
    createdAt: member?.createdAt || new Date().toISOString(),
    updatedAt: member?.updatedAt || new Date().toISOString(),
  };
}

export function createClubMemberRecord({ tenantId, clubId, playerId, role, status }) {
  const now = new Date().toISOString();
  return normalizeClubMember({
    id: `cm-${clubId}-${playerId}`,
    tenantId,
    clubId,
    playerId,
    role: role || CLUB_MEMBER_ROLES.MEMBER,
    status: status || CLUB_MEMBER_STATUSES.ACTIVE,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

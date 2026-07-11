/**
 * Phase 42L — role × membership menu matrix (sidebar + mobile drawer SSOT).
 * @see docs/v5/PHASE_42X_CLUB_UX_BLUEPRINT.md §6
 */
import { PERMISSIONS } from "../../../auth/permissions.js";
import {
  ROLES,
  isGlobalRole,
  isVenueScopedRole,
  normalizeRole,
} from "../../../auth/roles.js";
import { MEMBERSHIP_PHASE } from "../membership/membershipState.js";
import {
  hasClubGovernanceManagerAccess,
  isClubPresident,
  isClubVicePresident,
} from "../services/governanceRoleElevation.js";
import { isClubOwner } from "../services/clubGovernanceService.js";

/** Menu keys governed by membership + governance (club group). */
export const CLUB_NAV_GATED_KEYS = new Set([
  "club-activity",
  "my-club",
  "discover-clubs",
  "club-create",
  "club-membership-requests",
  "club-governance-manage",
  "club-list",
  "club-daily-play",
  "club-platform-all",
]);

export const CLUB_NAV_ITEM_KEYS = Object.freeze({
  CLUB_OPERATIONS: "club-activity",
  MY_CLUB: "my-club",
  DISCOVER: "discover-clubs",
  CREATE: "club-create",
  MEMBERSHIP_REQUESTS: "club-membership-requests",
  GOVERNANCE_MANAGE: "club-governance-manage",
  MANAGE_LIST: "club-list",
  DAILY_PLAY: "club-daily-play",
  PLATFORM_ALL: "club-platform-all",
});

/**
 * @param {{
 *   user: object|null,
 *   membership: object|null,
 *   can: Function|null,
 *   tenantId: string|null,
 * }} input
 */
export function buildClubNavContext({ user, membership, can, tenantId = null }) {
  if (!user?.id) {
    return null;
  }

  const role = normalizeRole(user.role);
  const club = membership?.club || null;
  const hasActiveMembership = Boolean(membership?.hasActiveMembership && membership?.clubId);
  const membershipReady =
    !membership ||
    membership.phase === MEMBERSHIP_PHASE.ACTIVE ||
    membership.phase === MEMBERSHIP_PHASE.NONE ||
    membership.phase === MEMBERSHIP_PHASE.ERROR;

  const isSa = role === ROLES.SUPER_ADMIN || role === ROLES.PLATFORM_ADMIN;
  const isPlayerLike = role === ROLES.PLAYER || role === ROLES.CUSTOMER;
  const isTenantStaff =
    isVenueScopedRole(user.role) ||
    role === ROLES.CLUB_MANAGER ||
    role === ROLES.STAFF ||
    role === ROLES.COURT_OWNER;

  const hasGovernanceRole =
    hasActiveMembership &&
    club &&
    (isClubPresident(user, club) ||
      isClubVicePresident(user, club) ||
      isClubOwner(user, club) ||
      hasClubGovernanceManagerAccess(user, club));

  const canCreateClub =
    Boolean(can) &&
    !hasActiveMembership &&
    can(PERMISSIONS.CLUB_CREATE, {
      venueId: tenantId || user.venueId || user.venue_id,
      tenantId: tenantId || user.tenantId || user.venueId || user.venue_id,
    }) &&
    (isPlayerLike || isTenantStaff || isSa);

  const canReviewMembership = Boolean(
    hasActiveMembership && club && hasGovernanceRole && !isSaWithoutGovernance(user, club)
  );

  return {
    role,
    membershipReady,
    hasActiveMembership,
    membershipClubId: membership?.clubId || null,
    club,
    isSa,
    isPlayerLike,
    isTenantStaff,
    hasGovernanceRole,
    canCreateClub,
    canReviewMembership,
    saNoMembership: isSa && !hasActiveMembership,
    saWithMembership: isSa && hasActiveMembership,
  };
}

/** SA / platform admin without club governance assignment — no membership review UI. */
export function isSaWithoutGovernance(user, club) {
  if (!user || !isGlobalRole(user.role)) {
    return false;
  }
  if (!club) {
    return true;
  }
  return !(
    isClubPresident(user, club) ||
    isClubVicePresident(user, club) ||
    isClubOwner(user, club)
  );
}

/**
 * Phase 42L menu visibility override.
 * @returns {boolean|null} true=force visible, false=hidden, null=fall through RBAC
 */
export function isClubNavItemVisible(itemKey, ctx) {
  if (!ctx || !CLUB_NAV_GATED_KEYS.has(itemKey)) {
    return null;
  }

  if (!ctx.membershipReady && ctx.isPlayerLike) {
    return itemKey === CLUB_NAV_ITEM_KEYS.DISCOVER ? true : null;
  }

  switch (itemKey) {
    case CLUB_NAV_ITEM_KEYS.MY_CLUB:
      if (ctx.saNoMembership) return false;
      if (ctx.isPlayerLike && !ctx.hasActiveMembership) return false;
      return ctx.hasActiveMembership || ctx.isTenantStaff;

    case CLUB_NAV_ITEM_KEYS.DISCOVER:
      if (ctx.isSa) return false;
      if (ctx.isTenantStaff && !ctx.isPlayerLike) return false;
      return ctx.isPlayerLike || !ctx.hasActiveMembership;

    case CLUB_NAV_ITEM_KEYS.CREATE:
      return ctx.canCreateClub;

    case CLUB_NAV_ITEM_KEYS.MEMBERSHIP_REQUESTS:
      return ctx.canReviewMembership;

    case CLUB_NAV_ITEM_KEYS.GOVERNANCE_MANAGE:
      return ctx.hasGovernanceRole && ctx.hasActiveMembership;

    case CLUB_NAV_ITEM_KEYS.CLUB_OPERATIONS:
      if (ctx.isPlayerLike && !ctx.hasGovernanceRole) return false;
      if (ctx.saNoMembership) return false;
      return ctx.hasGovernanceRole || ctx.isTenantStaff;

    case CLUB_NAV_ITEM_KEYS.MANAGE_LIST:
      return ctx.isTenantStaff || ctx.isSa;

    case CLUB_NAV_ITEM_KEYS.DAILY_PLAY:
      if (ctx.isPlayerLike && !ctx.hasGovernanceRole) return false;
      if (ctx.saNoMembership) return false;
      return ctx.hasGovernanceRole || ctx.isTenantStaff;

    case CLUB_NAV_ITEM_KEYS.PLATFORM_ALL:
      return ctx.isSa;

    default:
      return null;
  }
}

/** My Club hub tab visibility (§6.2). */
export function resolveMyClubTabVisibility(ctx) {
  if (!ctx?.hasActiveMembership) {
    return {
      discover: true,
      home: false,
      schedule: false,
      members: false,
    };
  }

  const readOnlyMember = ctx.isPlayerLike && !ctx.hasGovernanceRole;
  return {
    discover: true,
    home: true,
    schedule: true,
    members: true,
    membersReadOnly: readOnlyMember,
    membersCanReview: ctx.canReviewMembership,
  };
}

export function applyClubNavMenuOverride(item, ctx) {
  const override = isClubNavItemVisible(item?.key, ctx);
  if (override === false) {
    return false;
  }
  if (override === true) {
    return true;
  }
  return null;
}

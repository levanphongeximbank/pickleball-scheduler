/**
 * Phase 2E — Club governance canonical READ model (pure, framework-free).
 *
 * Authority rules:
 * - Governance assignment refs (owner / president / VP user ids) are role authority.
 * - Canonical membership is eligibility (active only for "active officer" display).
 * - Profile fields are display-only (display_name, avatar_url).
 * - profiles.club_id must NEVER prove governance or membership.
 * - Legacy blob roles must NEVER be the V2 read source.
 *
 * This module reads NO storage and performs NO RPC — it only transforms inputs.
 */

import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";

/** Explicit read states surfaced to governance UI. */
export const GOVERNANCE_READ_STATE = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
});

/** Consistent Vietnamese role labels (single source). */
export const GOVERNANCE_ROLE_LABELS = Object.freeze({
  owner: "Chủ sở hữu",
  president: "Chủ tịch",
  vice_president: "Phó chủ tịch",
  owner_and_president: "Chủ sở hữu & Chủ tịch",
});

/** Neutral fallback when profile hydration is missing. */
export const GOVERNANCE_MISSING_PROFILE_LABEL = "Chưa có thông tin";

/** Empty assignment (no officer id). */
export const GOVERNANCE_UNASSIGNED_LABEL = "Chưa gán";

/** Empty VP list display. */
export const GOVERNANCE_NO_VP_LABEL = "—";

const ACTIVE_MEMBERSHIP_STATUSES = new Set(["active", "ACTIVE"]);

function trimId(value) {
  const id = String(value || "").trim();
  return id || null;
}

function sameUserId(a, b) {
  const left = trimId(a);
  const right = trimId(b);
  if (!left || !right) {
    return false;
  }
  return left === right;
}

function isPlaceholderLabel(label, userId) {
  const text = String(label || "").trim();
  const id = trimId(userId);
  if (!text) {
    return true;
  }
  if (!id) {
    return false;
  }
  return text === `User ${id.slice(0, 8)}`;
}

function isActiveMembershipStatus(status) {
  if (status == null || status === "") {
    // Unknown status from server projection: treat as eligible unless marked inactive.
    return true;
  }
  return ACTIVE_MEMBERSHIP_STATUSES.has(String(status).trim());
}

/**
 * Canonical governance read mode (V2 Production path).
 * When V2 is OFF, legacy registry remains documented fallback — not Production authority.
 *
 * @param {{ v2StorageEnabled?: boolean, hasSupabase?: boolean }} params
 * @returns {boolean}
 */
export function isCanonicalGovernanceReadEnabled({
  v2StorageEnabled,
  hasSupabase,
} = {}) {
  // Production V2 path: club_get / assignments are authoritative.
  if (v2StorageEnabled) {
    return true;
  }
  // V2 OFF: legacy registry fallback (documented; not Production authority).
  void hasSupabase;
  return false;
}

/**
 * Map transport/repo codes → registered API error codes.
 * @param {string|null|undefined} code
 * @returns {string}
 */
export function mapRepoCodeToGovernanceError(code) {
  switch (code) {
    case "CLUB_OUT_OF_SCOPE":
      return API_ERROR_CODES.CLUB_OUT_OF_SCOPE;
    case "VALIDATION_ERROR":
      return API_ERROR_CODES.VALIDATION_ERROR;
    case "CLUB_REQUIRED":
    case "CLUB_ID_REQUIRED":
      return API_ERROR_CODES.CLUB_REQUIRED;
    case "NOT_FOUND":
      return API_ERROR_CODES.NOT_FOUND;
    case "FORBIDDEN":
    case "TENANT_FORBIDDEN":
    case "CROSS_TENANT_ACCESS":
    case "TENANT_MISMATCH":
      return API_ERROR_CODES.FORBIDDEN;
    case "VERSION_CONFLICT":
      return API_ERROR_CODES.CONFLICT;
    default:
      return API_ERROR_CODES.INTERNAL_ERROR;
  }
}

/**
 * Build one governance person slot.
 * Profile is display-only; membership status gates "active" presentation.
 *
 * @param {object} params
 * @returns {object|null}
 */
export function buildGovernancePerson({
  userId,
  membershipId = null,
  displayName = null,
  avatarUrl = null,
  membershipStatus = null,
  profileMissing = false,
  cloudLabel = null,
  /** Explicitly ignore profiles.club_id even if present on a profile bag. */
  profileClubId = null,
} = {}) {
  const id = trimId(userId);
  if (!id) {
    return null;
  }

  // profiles.club_id is never eligibility — recorded only so callers can assert ignore.
  void profileClubId;

  const inactive = !isActiveMembershipStatus(membershipStatus);
  const cloud = String(cloudLabel || "").trim();
  const hinted = String(displayName || "").trim();
  const usableName =
    (!isPlaceholderLabel(cloud, id) && cloud) ||
    (!isPlaceholderLabel(hinted, id) && hinted) ||
    null;

  // Profile missing only when we have no usable display string (cloud label counts).
  const missingProfile = !usableName;
  const staleReference = inactive;

  return {
    user_id: id,
    membership_id: membershipId ? String(membershipId) : null,
    display_name: staleReference || missingProfile ? null : usableName,
    avatar_url: staleReference ? null : avatarUrl ? String(avatarUrl) : null,
    membership_status: membershipStatus || null,
    profile_missing: Boolean(profileMissing) && missingProfile,
    stale_reference: staleReference,
    display_label:
      staleReference || missingProfile
        ? GOVERNANCE_MISSING_PROFILE_LABEL
        : usableName,
  };
}

/**
 * Normalize VP id list (max 2, ordered, unique).
 * @param {object} governance
 * @returns {string[]}
 */
export function normalizeVicePresidentIds(governance = {}) {
  if (Array.isArray(governance.vicePresidentUserIds)) {
    const ids = governance.vicePresidentUserIds.map(trimId).filter(Boolean);
    return [...new Set(ids)].slice(0, 2);
  }
  const single = trimId(governance.vicePresidentUserId);
  return single ? [single] : [];
}

/**
 * Map assignment role codes → VN label (member-list badges).
 * Does not infer from generic "admin"/"manager" strings.
 *
 * @param {string[]|null|undefined} roles
 * @returns {string|null}
 */
export function mapGovernanceRoleCodesToLabel(roles) {
  const list = (Array.isArray(roles) ? roles : []).map((role) =>
    String(role || "").trim().toLowerCase()
  );
  const has = (role) => list.includes(role);
  const isPresident = has("president") || has("club_president");
  const isOwner = has("club_owner") || has("owner");
  const isVice = has("vice_president") || has("club_vice_president");

  if (isPresident && isOwner) {
    return GOVERNANCE_ROLE_LABELS.owner_and_president;
  }
  if (isPresident) {
    return GOVERNANCE_ROLE_LABELS.president;
  }
  if (isVice) {
    return GOVERNANCE_ROLE_LABELS.vice_president;
  }
  if (isOwner) {
    return GOVERNANCE_ROLE_LABELS.owner;
  }
  return null;
}

/**
 * Resolve member badge from canonical governance ids (preferred) or role codes.
 *
 * @param {string} userId
 * @param {object|null} governance
 * @param {string[]|null} [roleCodes]
 * @returns {string|null}
 */
export function resolveMemberGovernanceRoleLabel(userId, governance, roleCodes = null) {
  const id = trimId(userId);
  if (!id || !governance) {
    return mapGovernanceRoleCodesToLabel(roleCodes);
  }

  const viceIds = normalizeVicePresidentIds(governance);
  const isPresident = sameUserId(id, governance.presidentUserId);
  const isOwner = sameUserId(id, governance.ownerUserId);
  const isVice = viceIds.some((vp) => sameUserId(id, vp));

  if (isPresident && isOwner) {
    return GOVERNANCE_ROLE_LABELS.owner_and_president;
  }
  if (isPresident) {
    return GOVERNANCE_ROLE_LABELS.president;
  }
  if (isVice) {
    return GOVERNANCE_ROLE_LABELS.vice_president;
  }
  if (isOwner) {
    return GOVERNANCE_ROLE_LABELS.owner;
  }
  return mapGovernanceRoleCodesToLabel(roleCodes);
}

/**
 * Unique governance person count (Owner+President same user → 1).
 * Does not include inactive/stale refs in the "active officers" count.
 *
 * @param {object} readModel
 * @returns {number}
 */
export function countUniqueActiveGovernancePersons(readModel) {
  const ids = new Set();
  const push = (person) => {
    if (!person?.user_id || person.stale_reference) {
      return;
    }
    ids.add(String(person.user_id));
  };
  push(readModel?.owner);
  push(readModel?.president);
  for (const vp of readModel?.vice_presidents || []) {
    push(vp);
  }
  return ids.size;
}

/**
 * Build display labels object compatible with existing UI helpers.
 *
 * @param {object} readModel
 * @returns {{
 *   ownerLabel: string,
 *   presidentLabel: string|null,
 *   vicePresidentLabel: string,
 *   vicePresidentLabels: string[],
 *   combinedOwnerPresident: boolean,
 * }}
 */
export function toGovernanceDisplayLabels(readModel) {
  const owner = readModel?.owner || null;
  const president = readModel?.president || null;
  const vps = Array.isArray(readModel?.vice_presidents)
    ? readModel.vice_presidents
    : [];

  const ownerLabel = owner
    ? owner.display_label || GOVERNANCE_MISSING_PROFILE_LABEL
    : GOVERNANCE_UNASSIGNED_LABEL;
  const presidentLabel = president
    ? president.display_label || GOVERNANCE_MISSING_PROFILE_LABEL
    : GOVERNANCE_UNASSIGNED_LABEL;
  const vicePresidentLabels = vps.map(
    (vp) => vp.display_label || GOVERNANCE_MISSING_PROFILE_LABEL
  );
  const vicePresidentLabel = vicePresidentLabels.length
    ? vicePresidentLabels.join(", ")
    : GOVERNANCE_NO_VP_LABEL;

  const combined =
    Boolean(owner?.user_id) &&
    Boolean(president?.user_id) &&
    sameUserId(owner.user_id, president.user_id);

  if (combined) {
    const base =
      (president && !president.profile_missing && !president.stale_reference
        ? president.display_label
        : null) ||
      (owner && !owner.profile_missing && !owner.stale_reference
        ? owner.display_label
        : null) ||
      GOVERNANCE_MISSING_PROFILE_LABEL;
    return {
      ownerLabel: `${base} (${GOVERNANCE_ROLE_LABELS.owner_and_president})`,
      presidentLabel: null,
      vicePresidentLabel,
      vicePresidentLabels,
      combinedOwnerPresident: true,
    };
  }

  return {
    ownerLabel,
    presidentLabel,
    vicePresidentLabel,
    vicePresidentLabels,
    combinedOwnerPresident: false,
  };
}

/**
 * Build the canonical governance read model from a mapped club (+ optional hydration bags).
 *
 * Contract inputs (ignored when unsafe):
 * - profiles.club_id — never eligibility
 * - legacyBlobRoles — never V2 source
 *
 * @param {object} params
 * @param {object|null} params.club mapped UI club (from mapV2ClubToUiClub / registry)
 * @param {object} [params.profileByUserId] { [userId]: { displayName, avatarUrl, clubId? } }
 * @param {object} [params.membershipByUserId] { [userId]: { id, status } }
 * @param {boolean} [params.v2Enabled]
 * @param {string[]|null} [params.legacyBlobRoles] ignored under V2
 * @returns {object}
 */
export function toGovernanceReadModel({
  club = null,
  profileByUserId = null,
  membershipByUserId = null,
  v2Enabled = true,
  legacyBlobRoles = null,
} = {}) {
  // Explicitly discard unsafe signals.
  void legacyBlobRoles;

  const clubId = trimId(club?.id);
  const tenantId = trimId(club?.tenantId || club?.venueId);
  const version =
    club?.version != null && Number.isFinite(Number(club.version))
      ? Number(club.version)
      : null;

  const gov = club?.governance || {};
  const ownerId = trimId(gov.ownerUserId);
  const presidentId = trimId(gov.presidentUserId);
  // Under V2: never invent president from createdBy / blob.
  // Under V2 OFF legacy: still only use explicit governance ids (no createdBy inference).
  void v2Enabled;

  const viceIds = normalizeVicePresidentIds(gov);
  const cloudVpLabels = Array.isArray(club?.vicePresidentLabels)
    ? club.vicePresidentLabels
    : club?.vicePresidentLabel
      ? [club.vicePresidentLabel]
      : [];

  const profiles = profileByUserId && typeof profileByUserId === "object"
    ? profileByUserId
    : {};
  const memberships =
    membershipByUserId && typeof membershipByUserId === "object"
      ? membershipByUserId
      : {};

  const buildSlot = (userId, cloudLabel) => {
    const id = trimId(userId);
    if (!id) {
      return null;
    }
    const profile = profiles[id] || profiles[String(id).toLowerCase()] || null;
    const membership = memberships[id] || null;
    // Never use profile.clubId for eligibility — pass through for audit only.
    return buildGovernancePerson({
      userId: id,
      membershipId: membership?.id || membership?.membership_id || null,
      displayName: profile?.displayName || profile?.display_name || null,
      avatarUrl: profile?.avatarUrl || profile?.avatar_url || null,
      membershipStatus: membership?.status ?? null,
      profileMissing: !profile,
      cloudLabel:
        cloudLabel ||
        (sameUserId(id, ownerId) ? club?.ownerLabel : null) ||
        (sameUserId(id, presidentId) ? club?.presidentLabel : null),
      profileClubId: profile?.clubId || profile?.club_id || null,
    });
  };

  const owner = buildSlot(ownerId, club?.ownerLabel);
  const president = buildSlot(presidentId, club?.presidentLabel);
  const vice_presidents = viceIds.map((id, index) =>
    buildSlot(id, cloudVpLabels[index] || null)
  );

  const labels = toGovernanceDisplayLabels({
    owner,
    president,
    vice_presidents,
  });

  return {
    club_id: clubId,
    tenant_id: tenantId,
    club_version: version,
    owner,
    president,
    vice_presidents,
    source: {
      provider: club?.source || (v2Enabled ? "v2-rpc" : "legacy-registry"),
      authority: "club_governance_assignments",
      membership_authority: "club_members",
      profile_authority: "profiles_display_only",
      ignored: {
        profiles_club_id: true,
        legacy_blob_roles: Boolean(v2Enabled),
      },
    },
    labels,
    unique_active_officer_count: countUniqueActiveGovernancePersons({
      owner,
      president,
      vice_presidents,
    }),
    active_member_count:
      club?.activeMemberCount != null
        ? Number(club.activeMemberCount) || 0
        : null,
  };
}

/**
 * Map a governanceGet / service result → UI snapshot (loading/error never invent officers).
 *
 * @param {object|null} result
 * @returns {{ state: string, readModel: object|null, errorCode: string|null, version: number|null }}
 */
export function toGovernanceReadSnapshot(result) {
  if (!result) {
    return {
      state: GOVERNANCE_READ_STATE.ERROR,
      readModel: null,
      errorCode: API_ERROR_CODES.INTERNAL_ERROR,
      version: null,
    };
  }
  if (result.ok) {
    return {
      state: GOVERNANCE_READ_STATE.READY,
      readModel: result.readModel || null,
      errorCode: null,
      version:
        result.version ??
        result.readModel?.club_version ??
        null,
    };
  }
  return {
    state: GOVERNANCE_READ_STATE.ERROR,
    readModel: null,
    errorCode: mapRepoCodeToGovernanceError(result.code),
    version: null,
  };
}

/**
 * VERSION_CONFLICT → UI must refetch; never keep pre-mutation officers.
 *
 * @param {string|null|undefined} code
 * @returns {boolean}
 */
export function shouldRefetchGovernanceOnConflict(code) {
  return String(code || "").trim().toUpperCase() === "VERSION_CONFLICT";
}

/**
 * Decide whether an open screen should refresh after a mutation result.
 *
 * @param {{ ok?: boolean, code?: string, version?: number|null, previousVersion?: number|null }} params
 * @returns {{ refresh: boolean, reason: string|null }}
 */
export function resolveGovernanceRefreshAction({
  ok,
  code,
  version = null,
  previousVersion = null,
} = {}) {
  if (shouldRefetchGovernanceOnConflict(code)) {
    return { refresh: true, reason: "VERSION_CONFLICT" };
  }
  if (ok) {
    return { refresh: true, reason: "MUTATION_SUCCESS" };
  }
  if (
    version != null &&
    previousVersion != null &&
    Number(version) !== Number(previousVersion)
  ) {
    return { refresh: true, reason: "VERSION_CHANGED" };
  }
  return { refresh: false, reason: null };
}

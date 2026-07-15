import { getCurrentUser } from "../../../auth/authService.js";
import { ROLES, normalizeRole } from "../../../auth/roles.js";
import { saveAuthSession, loadAuthSession } from "../../../auth/authStorage.js";
import { normalizeUser } from "../../../models/user.js";
import { getClubById as getRegistryClubById } from "../../../domain/clubService.js";
import { loadClubs } from "../../../data/club.js";
import {
  loadClubData,
  saveClubData,
  loadPlayersForClub,
} from "../../../domain/clubStorage.js";
import { normalizePlayers } from "../../../models/player.js";
import { guardClubTenant, resolveTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import { CLUB_STATUSES } from "../constants/clubStatus.js";
import { CLUB_MEMBERSHIP_REQUEST_STATUSES } from "../constants/clubMembershipRequestStatuses.js";
import {
  createClubMembershipRequestRecord,
  normalizeClubMembershipRequest,
} from "../models/clubMembershipRequest.js";
import { loadClubExtension, saveClubExtension } from "../storage/clubExtensionStorage.js";
import { saveAthleteClubLink } from "../storage/athleteClubLinkStore.js";
import { getClubsByTenant } from "./clubTenantService.js";
import { addMemberToClub } from "./clubMemberService.js";
import {
  canApproveClubMembershipRequests,
  getGovernanceDisplayLabels,
  getRegisteredClusterLabel,
  formatRegisteredClusterDisplay,
} from "./clubGovernanceService.js";
import { getPickVnRatingByAuthUserId } from "../../pick-vn-rating/services/pickVnRatingService.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import {
  rpcV2ClubCancelMembershipRequest,
  rpcV2ClubLeaveMembership,
  rpcV2ClubSubmitMembershipRequest,
  rpcV2ClubListMyRequests,
  rpcV2ClubListPendingRequests,
  rpcV2ClubReviewMembershipRequest,
  rpcV2ClubGet,
} from "./clubStorageV2RpcService.js";
import { mapClubCommandError } from "./clubCommandErrorMap.js";
import { invalidateAllClubRegistryCache } from "../registry/clubRegistryCache.js";
import { invalidateMyActiveClubMembershipCache } from "./clubActiveMembershipService.js";
import { syncRatingToClubPlayer } from "../../pick-vn-rating/services/pickVnRatingService.js";
import { rpcReviewClubMembershipRequest, rpcLeaveMyClub } from "./clubMembershipRequestRpcService.js";
import { removeMemberFromClub } from "./clubMemberService.js";
import {
  isClubPresident,
  isClubVicePresident,
} from "./clubGovernanceService.js";
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";

/** Phase 45A.4B — invalidate request / roster / club summary caches after command success. */
function invalidateAfterMembershipCommand(userId = null) {
  invalidateAllClubRegistryCache();
  invalidateMyActiveClubMembershipCache(userId);
}

function mapMembershipCommandError(result, fallbackError) {
  return mapClubCommandError(result, {
    fallbackCode: API_ERROR_CODES.INTERNAL_ERROR,
    fallbackError,
  });
}

function mapV2MembershipRequestRow(row, clubId) {
  if (!row) {
    return null;
  }
  const status =
    row.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.APPROVED
      ? CLUB_MEMBERSHIP_REQUEST_STATUSES.APPROVED
      : row.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED
        ? CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED
        : row.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.CANCELLED
          ? CLUB_MEMBERSHIP_REQUEST_STATUSES.CANCELLED
          : CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING;

  return normalizeClubMembershipRequest({
    id: row.id,
    clubId: row.club_id || clubId,
    userId: row.user_id,
    displayName: row.display_name || "",
    message: row.message || "",
    status,
    requestedAt: row.created_at || new Date().toISOString(),
    version: row.version,
  });
}

function mapV2ReviewResult(data, clubId) {
  if (!data) {
    return null;
  }
  const status =
    data.status === "approved"
      ? CLUB_MEMBERSHIP_REQUEST_STATUSES.APPROVED
      : data.status === "rejected"
        ? CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED
        : data.status;

  return normalizeClubMembershipRequest({
    id: data.id,
    clubId: data.club_id || clubId,
    userId: data.user_id,
    status,
    approvedPlayerId: data.member_id || null,
  });
}

function buildPlayerIdForUser(userId) {
  const safe = String(userId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return `player-auth-${safe}`;
}

function getMembershipRequests(ext) {
  return (ext.membershipRequests || [])
    .map((item) => normalizeClubMembershipRequest(item))
    .filter(Boolean);
}

function saveMembershipRequests(clubId, ext, requests) {
  return saveClubExtension(clubId, {
    ...ext,
    membershipRequests: requests.map((item) => normalizeClubMembershipRequest(item)),
  });
}

function resolveUserClubId(user) {
  return user?.clubId || user?.club_id || null;
}

function findPlayerByAuthUserId(clubId, authUserId) {
  const players = loadPlayersForClub(clubId);
  return players.find((player) => String(player.authUserId || "") === String(authUserId)) || null;
}

function ensurePlayerInClubBlob({ clubId, tenantId, user, displayName, pickVnRating }) {
  const club = getRegistryClubById(clubId);
  const data = loadClubData(clubId);
  const players = [...(data.players || [])];
  const existing = findPlayerByAuthUserId(clubId, user.id);

  if (existing) {
    return { ok: true, player: existing, created: false };
  }

  const playerId = buildPlayerIdForUser(user.id);
  if (players.some((player) => player.id === playerId)) {
    const found = players.find((player) => player.id === playerId);
    return { ok: true, player: found, created: false };
  }

  const rating = pickVnRating ?? getPickVnRatingByAuthUserId(user.id)?.currentRating ?? 3.5;
  const basePlayer = normalizePlayers([
    {
      id: playerId,
      name: displayName || user.displayName || user.email || "VĐV",
      tenantId,
      level: rating,
      status: "active",
      active: true,
      authUserId: user.id,
      clubName: club?.name || "",
      phone: user.phone || "",
    },
  ])[0];

  const player = syncRatingToClubPlayer(basePlayer, user.id);
  players.push(player);
  saveClubData(clubId, { ...data, players, tenantId: data.tenantId || tenantId });
  return { ok: true, player, created: true };
}

async function linkAthleteProfile({ userId, clubId, playerId }) {
  const localResult = saveAthleteClubLink(userId, { clubId, playerId });
  if (!localResult.ok) {
    return localResult;
  }

  const session = loadAuthSession();
  if (session?.user?.id === userId) {
    const nextUser = normalizeUser({
      ...session.user,
      clubId,
      playerId,
    });
    saveAuthSession(nextUser, { provider: session.provider || "dev" });
  }

  // Phase 45A.4B — legacy profile-link RPC is V2-OFF only. Under V2, membership SSOT
  // is club_members via club_review_membership_request; never invoke Phase31 here.
  if (isClubStorageV2Enabled()) {
    return { ok: true, playerId, clubId };
  }

  const rpcResult = await rpcReviewClubMembershipRequest({
    userId,
    clubId,
    playerId,
    action: "approve",
  });

  if (rpcResult.ok === false && rpcResult.code !== "RPC_NOT_DEPLOYED" && rpcResult.code !== "NO_SUPABASE") {
    return rpcResult;
  }

  return { ok: true, playerId, clubId };
}

async function unlinkAthleteProfile({ userId, skipLegacyRpc = false } = {}) {
  const localResult = saveAthleteClubLink(userId, { clubId: null, playerId: null });
  if (!localResult.ok) {
    return localResult;
  }

  const session = loadAuthSession();
  if (session?.user?.id === userId) {
    const nextUser = normalizeUser({
      ...session.user,
      clubId: null,
      playerId: null,
      club_id: null,
      player_id: null,
    });
    saveAuthSession(nextUser, { provider: session.provider || "dev" });
  }

  if (skipLegacyRpc || isClubStorageV2Enabled()) {
    return { ok: true };
  }

  const rpcResult = await rpcLeaveMyClub();
  if (rpcResult.ok === false && rpcResult.code !== "RPC_NOT_DEPLOYED" && rpcResult.code !== "NO_SUPABASE") {
    return rpcResult;
  }

  return { ok: true };
}

export async function leaveMyClub({ user, tenantId = null, clubId: clubIdOverride = null } = {}) {
  const athlete = normalizeUser(user || getCurrentUser());
  const clubId = clubIdOverride || resolveUserClubId(athlete);
  const playerId = athlete?.playerId || athlete?.player_id || null;

  if (!athlete?.id) {
    return {
      ok: false,
      code: API_ERROR_CODES.FORBIDDEN,
      error: "Chưa đăng nhập.",
    };
  }

  if (!clubId) {
    return {
      ok: false,
      code: API_ERROR_CODES.CLUB_REQUIRED,
      error: "Bạn chưa thuộc CLB nào.",
    };
  }

  if (isClubStorageV2Enabled()) {
    const left = await rpcV2ClubLeaveMembership({ clubId });
    if (!left.ok) {
      return mapMembershipCommandError(left, "Không rời được câu lạc bộ.");
    }
    // Session/local athlete-link cleanup only — not membership authority (SSOT = club_members).
    await unlinkAthleteProfile({ userId: athlete.id, skipLegacyRpc: true });
    invalidateAfterMembershipCommand(athlete.id);
    return { ok: true, clubId, provider: "v2-rpc" };
  }

  if (!playerId) {
    return { ok: false, error: "Không tìm thấy hồ sơ VĐV trong CLB." };
  }

  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (isClubPresident(athlete, club) || isClubVicePresident(athlete, club)) {
    return {
      ok: false,
      code: API_ERROR_CODES.FORBIDDEN,
      error: "Chuyển vai trò Chủ tịch / Phó chủ tịch trước khi rời CLB.",
    };
  }

  const resolvedTenantId =
    tenantId || club.venueId || club.tenantId || athlete.tenantId || athlete.venueId || null;

  const memberResult = await removeMemberFromClub(clubId, playerId, resolvedTenantId, {
    skipPermissionGuard: true,
  });

  if (!memberResult.ok) {
    return memberResult;
  }

  const unlinkResult = await unlinkAthleteProfile({ userId: athlete.id });
  if (!unlinkResult.ok) {
    return unlinkResult;
  }

  return { ok: true, clubId, playerId };
}

export async function adminLinkAccountOnlyAthleteToClub({ clubId, user, tenantId = null }) {
  const trimmedClubId = String(clubId || "").trim();
  const normalizedUser = normalizeUser(user);
  if (!trimmedClubId || !normalizedUser?.id) {
    return { ok: false, error: "Thiếu CLB hoặc user." };
  }

  const tenantCheck = guardClubTenant(trimmedClubId, tenantId || normalizedUser.tenantId || normalizedUser.venueId);
  if (!tenantCheck.ok) {
    return tenantCheck;
  }

  const club = getRegistryClubById(trimmedClubId);
  const resolvedTenantId =
    tenantId || club?.venueId || club?.tenantId || normalizedUser.tenantId || normalizedUser.venueId || null;

  // Phase 45A.4C.4 — V2: canonical club_add_member by auth user_id; no blob roster write.
  if (isClubStorageV2Enabled()) {
    const memberResult = await addMemberToClub(trimmedClubId, null, resolvedTenantId, {
      skipPermissionGuard: true,
      targetUserId: normalizedUser.id,
    });
    if (!memberResult.ok) {
      return memberResult;
    }
    const linkResult = await linkAthleteProfile({
      userId: normalizedUser.id,
      clubId: trimmedClubId,
      playerId: normalizedUser.id,
    });
    if (!linkResult.ok) {
      return linkResult;
    }
    return {
      ok: true,
      playerId: normalizedUser.id,
      clubId: trimmedClubId,
      memberId: memberResult.member?.id || null,
      provider: "v2-rpc",
      created: true,
    };
  }

  const ensureResult = ensurePlayerInClubBlob({
    clubId: trimmedClubId,
    tenantId: resolvedTenantId,
    user: normalizedUser,
    displayName: normalizedUser.displayName,
  });

  if (!ensureResult.ok) {
    return ensureResult;
  }

  const linkResult = await linkAthleteProfile({
    userId: normalizedUser.id,
    clubId: trimmedClubId,
    playerId: ensureResult.player.id,
  });

  if (!linkResult.ok) {
    return linkResult;
  }

  return {
    ok: true,
    player: ensureResult.player,
    playerId: ensureResult.player.id,
    clubId: trimmedClubId,
    created: ensureResult.created,
  };
}

export function listJoinableClubs(tenantId) {
  return getClubsByTenant(tenantId).filter((club) => club.status === CLUB_STATUSES.ACTIVE);
}

/** Tất cả CLB active trên nền tảng (không lọc tenant). */
export function listDiscoverableClubs() {
  return loadClubs().filter(
    (club) => !club.isDefault && club.status === CLUB_STATUSES.ACTIVE
  );
}

/** Thống kê công khai cho trang khám phá CLB — không kiểm tra canUserViewClub. */
export function getClubDiscoverySummary(clubId) {
  const club = getRegistryClubById(clubId);
  if (!club) {
    return null;
  }

  const tenantId = resolveTenantIdForClub(clubId);
  const ext = loadClubExtension(clubId);
  const activeMembers = ext.members.filter((member) => member.status === "active");
  const gov = getGovernanceDisplayLabels(club, tenantId);
  const clusterLabel = getRegisteredClusterLabel(club, tenantId);
  const presidentLabel =
    gov.presidentLabel ||
    (gov.combinedOwnerPresident && gov.ownerLabel
      ? String(gov.ownerLabel).replace(" (Chủ sở hữu & Chủ tịch)", "")
      : null);

  return {
    id: club.id,
    name: club.name,
    status: club.status,
    tenantId,
    presidentLabel,
    ownerLabel: gov.ownerLabel || null,
    activeMemberCount: activeMembers.length,
    clusterLabel: formatRegisteredClusterDisplay(clusterLabel),
  };
}

/** Quét yêu cầu gia nhập của user trên mọi CLB discoverable. */
export function listMyMembershipRequestsAll(userId) {
  const trimmedUserId = String(userId || "").trim();
  if (!trimmedUserId) {
    return [];
  }

  const results = [];
  for (const club of listDiscoverableClubs()) {
    const ext = loadClubExtension(club.id);
    for (const request of getMembershipRequests(ext)) {
      if (request.userId === trimmedUserId) {
        results.push({ ...request, clubName: club.name });
      }
    }
  }

  return results.sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
}

export function listMyMembershipRequests(tenantId, userId) {
  const trimmedUserId = String(userId || "").trim();
  if (!trimmedUserId || !tenantId) {
    return [];
  }

  const results = [];
  for (const club of listJoinableClubs(tenantId)) {
    const ext = loadClubExtension(club.id);
    for (const request of getMembershipRequests(ext)) {
      if (request.userId === trimmedUserId) {
        results.push({ ...request, clubName: club.name });
      }
    }
  }

  return results.sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
}

export async function listPendingMembershipRequests(clubId, tenantId, user = getCurrentUser()) {
  const trimmedClubId = String(clubId || "").trim();
  if (!trimmedClubId) {
    return [];
  }

  if (isClubStorageV2Enabled()) {
    const result = await rpcV2ClubListPendingRequests(trimmedClubId);
    if (!result.ok) {
      return [];
    }
    return (result.requests || [])
      .map((row) => mapV2MembershipRequestRow(row, trimmedClubId))
      .filter(Boolean);
  }

  const club = getRegistryClubById(trimmedClubId);
  if (!club) {
    return [];
  }

  if (!canApproveClubMembershipRequests(user, club)) {
    return [];
  }

  if (tenantId) {
    const tenantCheck = guardClubTenant(trimmedClubId, tenantId, { user });
    if (!tenantCheck.ok) {
      return [];
    }
  }

  const ext = loadClubExtension(trimmedClubId);
  return getMembershipRequests(ext).filter(
    (request) => request.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING
  );
}

/**
 * Phase 45A.4B — orchestrator probe for review access (UI must not call list-pending RPC).
 * Returns `{ ok: true }` when the pending-list RPC succeeds (includes empty list).
 */
export async function probeMembershipReviewAccess(clubId) {
  const trimmedClubId = String(clubId || "").trim();
  if (!trimmedClubId) {
    return { ok: false, code: API_ERROR_CODES.CLUB_REQUIRED, error: "Thiếu CLB." };
  }

  if (!isClubStorageV2Enabled()) {
    return { ok: true, provider: "blob" };
  }

  const result = await rpcV2ClubListPendingRequests(trimmedClubId);
  if (!result.ok) {
    return mapMembershipCommandError(result, "Không kiểm tra được quyền duyệt.");
  }
  return { ok: true, provider: "v2-rpc" };
}

/**
 * Phase 45A.4B — list caller's membership requests via orchestrator (no UI→RPC bypass).
 */
export async function listMyMembershipRequestsCanonical(userId) {
  const trimmedUserId = String(userId || "").trim();

  if (isClubStorageV2Enabled()) {
    const result = await rpcV2ClubListMyRequests();
    if (!result.ok) {
      return mapMembershipCommandError(result, "Không tải được yêu cầu gia nhập.");
    }
    const requests = (result.requests || []).map((row) => ({
      id: row.id,
      clubId: row.club_id,
      userId: row.user_id,
      status: row.status,
      message: row.message || "",
      version: row.version,
      requestedAt: row.created_at,
      club_id: row.club_id,
      user_id: row.user_id,
      created_at: row.created_at,
    }));
    return { ok: true, requests, provider: "v2-rpc" };
  }

  if (!trimmedUserId) {
    return { ok: true, requests: [], provider: "blob" };
  }
  return {
    ok: true,
    requests: listMyMembershipRequestsAll(trimmedUserId),
    provider: "blob",
  };
}

function resolveMembershipRequestTenantCheck(clubId, clubTenantId, user) {
  const role = normalizeRole(user?.role);
  if (role === ROLES.PLAYER || role === ROLES.CUSTOMER) {
    return { ok: true };
  }

  return guardClubTenant(clubId, clubTenantId, { user });
}

export async function submitClubMembershipRequest(clubId, tenantId, user, options = {}) {
  const trimmedClubId = String(clubId || "").trim();
  const athlete = user || getCurrentUser();

  if (!athlete?.id) {
    return {
      ok: false,
      code: API_ERROR_CODES.FORBIDDEN,
      error: "Chưa đăng nhập.",
    };
  }

  if (isClubStorageV2Enabled()) {
    // Membership authority is club_members / requests_v42 (server ALREADY_MEMBER / PENDING_EXISTS).
    // Do not gate on legacy session club fields under V2.
    const result = await rpcV2ClubSubmitMembershipRequest({
      clubId: trimmedClubId,
      message: options.message || "",
    });
    if (!result.ok) {
      return mapMembershipCommandError(result, "Không gửi được yêu cầu gia nhập.");
    }
    invalidateAfterMembershipCommand(athlete.id);
    return { ok: true, request: result.data, provider: "v2-rpc" };
  }

  if (resolveUserClubId(athlete)) {
    return { ok: false, error: "Bạn đã thuộc một CLB." };
  }

  const club = getRegistryClubById(trimmedClubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (club.status !== CLUB_STATUSES.ACTIVE) {
    return { ok: false, error: "CLB chưa hoạt động, không thể xin tham gia." };
  }

  const clubTenantId = resolveTenantIdForClub(trimmedClubId);
  const trimmedTenantId = String(tenantId || clubTenantId || "").trim();
  const tenantCheck = resolveMembershipRequestTenantCheck(
    trimmedClubId,
    clubTenantId || trimmedTenantId,
    athlete
  );
  if (!tenantCheck.ok) {
    return tenantCheck;
  }

  const ext = loadClubExtension(trimmedClubId);
  const requests = getMembershipRequests(ext);
  const existingPending = requests.find(
    (request) =>
      request.userId === athlete.id &&
      request.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING
  );

  if (existingPending) {
    return { ok: false, error: "Bạn đã gửi yêu cầu tham gia CLB này." };
  }

  const ratingRecord = getPickVnRatingByAuthUserId(athlete.id);
  const request = createClubMembershipRequestRecord({
    tenantId: clubTenantId || trimmedTenantId,
    clubId: trimmedClubId,
    userId: athlete.id,
    displayName: athlete.displayName || athlete.email || "",
    pickVnRating: ratingRecord?.currentRating ?? null,
    message: options.message || "",
  });

  const withoutAthlete = requests.filter((item) => item.userId !== athlete.id);
  saveMembershipRequests(trimmedClubId, ext, [...withoutAthlete, request]);
  return { ok: true, request };
}

export async function cancelClubMembershipRequest(clubId, requestId, userId, options = {}) {
  const trimmedClubId = String(clubId || "").trim();
  const trimmedRequestId = String(requestId || "").trim();
  const trimmedUserId = String(userId || "").trim();

  if (isClubStorageV2Enabled()) {
    const result = await rpcV2ClubCancelMembershipRequest({
      membershipRequestId: trimmedRequestId,
      expectedVersion: options.expectedVersion ?? null,
    });
    if (!result.ok) {
      return mapMembershipCommandError(result, "Không hủy được yêu cầu gia nhập.");
    }
    invalidateAfterMembershipCommand(trimmedUserId || null);
    return { ok: true, ...result, provider: "v2-rpc" };
  }

  const ext = loadClubExtension(trimmedClubId);
  const requests = getMembershipRequests(ext);
  const index = requests.findIndex((request) => request.id === trimmedRequestId);

  if (index < 0) {
    return { ok: false, error: "Không tìm thấy yêu cầu." };
  }

  const current = requests[index];
  if (current.userId !== trimmedUserId) {
    return { ok: false, error: "Không có quyền hủy yêu cầu này." };
  }

  if (current.status !== CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING) {
    return { ok: false, error: "Chỉ hủy được yêu cầu đang chờ duyệt." };
  }

  const now = new Date().toISOString();
  const next = requests.map((request, i) =>
    i === index
      ? normalizeClubMembershipRequest({
          ...request,
          status: CLUB_MEMBERSHIP_REQUEST_STATUSES.CANCELLED,
          reviewedAt: now,
        })
      : request
  );

  saveMembershipRequests(trimmedClubId, ext, next);
  return { ok: true, request: next[index] };
}

async function resolveClubForMembershipReview(clubId) {
  if (isClubStorageV2Enabled()) {
    const result = await rpcV2ClubGet(clubId);
    if (!result.ok) {
      return null;
    }
    return result.club;
  }
  return getRegistryClubById(clubId);
}

export async function approveClubMembershipRequest(clubId, requestId, tenantId, options = {}) {
  const user = options.user || getCurrentUser();
  const club = await resolveClubForMembershipReview(clubId);
  if (!club) {
    return {
      ok: false,
      code: API_ERROR_CODES.NOT_FOUND,
      error: "Không tìm thấy CLB.",
    };
  }

  if (!canApproveClubMembershipRequests(user, club)) {
    return {
      ok: false,
      code: API_ERROR_CODES.FORBIDDEN,
      error: "Chỉ Chủ tịch / Phó chủ tịch / Chủ sở hữu CLB được duyệt.",
    };
  }

  const tenantCheck = guardClubTenant(clubId, tenantId, { user });
  if (!tenantCheck.ok) {
    return tenantCheck;
  }

  if (isClubStorageV2Enabled()) {
    const reviewed = await rpcV2ClubReviewMembershipRequest({
      membershipRequestId: requestId,
      decision: "approved",
      reviewNote: options.reviewNote || null,
      expectedVersion: options.expectedVersion ?? null,
    });
    if (!reviewed.ok) {
      return mapMembershipCommandError(reviewed, "Không duyệt được yêu cầu gia nhập.");
    }
    const request = mapV2ReviewResult(reviewed.data, clubId);
    // Member row is created by the server review transaction — no client roster/profile write.
    invalidateAfterMembershipCommand(reviewed.data?.user_id || null);
    return {
      ok: true,
      request,
      memberId: reviewed.data?.member_id || null,
      provider: "v2-rpc",
    };
  }

  const ext = loadClubExtension(clubId);
  const requests = getMembershipRequests(ext);
  const index = requests.findIndex((request) => request.id === requestId);
  if (index < 0) {
    return { ok: false, error: "Không tìm thấy yêu cầu." };
  }

  const current = requests[index];
  if (current.status !== CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING) {
    return { ok: false, error: "Yêu cầu không còn ở trạng thái chờ duyệt." };
  }

  const athleteUser = {
    id: current.userId,
    displayName: current.displayName,
    email: current.displayName,
  };

  const playerResult = ensurePlayerInClubBlob({
    clubId,
    tenantId,
    user: athleteUser,
    displayName: current.displayName,
    pickVnRating: current.pickVnRating,
  });

  if (!playerResult.ok) {
    return playerResult;
  }

  const memberResult = await addMemberToClub(clubId, playerResult.player.id, tenantId, {
    skipPermissionGuard: true,
  });

  if (!memberResult.ok) {
    return memberResult;
  }

  const linkResult = await linkAthleteProfile({
    userId: current.userId,
    clubId,
    playerId: playerResult.player.id,
  });

  if (!linkResult.ok) {
    return linkResult;
  }

  const now = new Date().toISOString();
  const next = requests.map((request, i) =>
    i === index
      ? normalizeClubMembershipRequest({
          ...request,
          status: CLUB_MEMBERSHIP_REQUEST_STATUSES.APPROVED,
          reviewedBy: user?.id || null,
          reviewedAt: now,
          reviewNote: options.reviewNote || "",
          approvedPlayerId: playerResult.player.id,
        })
      : request
  );

  saveMembershipRequests(clubId, ext, next);
  return {
    ok: true,
    request: next[index],
    player: playerResult.player,
    member: memberResult.member,
  };
}

export async function rejectClubMembershipRequest(clubId, requestId, tenantId, options = {}) {
  const user = options.user || getCurrentUser();
  const club = await resolveClubForMembershipReview(clubId);
  if (!club) {
    return {
      ok: false,
      code: API_ERROR_CODES.NOT_FOUND,
      error: "Không tìm thấy CLB.",
    };
  }

  if (!canApproveClubMembershipRequests(user, club)) {
    return {
      ok: false,
      code: API_ERROR_CODES.FORBIDDEN,
      error: "Chỉ Chủ tịch / Phó chủ tịch / Chủ sở hữu CLB được từ chối.",
    };
  }

  const tenantCheck = guardClubTenant(clubId, tenantId, { user });
  if (!tenantCheck.ok) {
    return tenantCheck;
  }

  if (isClubStorageV2Enabled()) {
    const reviewed = await rpcV2ClubReviewMembershipRequest({
      membershipRequestId: requestId,
      decision: "rejected",
      reviewNote: options.reviewNote || null,
      expectedVersion: options.expectedVersion ?? null,
    });
    if (!reviewed.ok) {
      return mapMembershipCommandError(reviewed, "Không từ chối được yêu cầu gia nhập.");
    }
    invalidateAfterMembershipCommand(reviewed.data?.user_id || null);
    return {
      ok: true,
      request: mapV2ReviewResult(reviewed.data, clubId),
      provider: "v2-rpc",
    };
  }

  const ext = loadClubExtension(clubId);
  const requests = getMembershipRequests(ext);
  const index = requests.findIndex((request) => request.id === requestId);
  if (index < 0) {
    return { ok: false, error: "Không tìm thấy yêu cầu." };
  }

  const current = requests[index];
  if (current.status !== CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING) {
    return { ok: false, error: "Yêu cầu không còn ở trạng thái chờ duyệt." };
  }

  const now = new Date().toISOString();
  const next = requests.map((request, i) =>
    i === index
      ? normalizeClubMembershipRequest({
          ...request,
          status: CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED,
          reviewedBy: user?.id || null,
          reviewedAt: now,
          reviewNote: options.reviewNote || "",
        })
      : request
  );

  saveMembershipRequests(clubId, ext, next);
  return { ok: true, request: next[index] };
}

export function getMyClubSummary(clubId, tenantId) {
  const club = getRegistryClubById(clubId);
  if (!club) {
    return null;
  }

  const ext = loadClubExtension(clubId);
  const activeMembers = ext.members.filter((member) => member.status === "active");

  return {
    id: club.id,
    name: club.name,
    status: club.status,
    memberCount: activeMembers.length,
    governance: club.governance || {},
    registeredClusterId: club.governance?.registeredClusterId || null,
    registeredCourtIds: club.governance?.registeredCourtIds || [],
  };
}

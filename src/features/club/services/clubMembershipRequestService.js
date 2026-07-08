import { getCurrentUser } from "../../../auth/authService.js";
import { saveAuthSession, loadAuthSession } from "../../../auth/authStorage.js";
import { normalizeUser } from "../../../models/user.js";
import { getClubById as getRegistryClubById } from "../../../domain/clubService.js";
import {
  loadClubData,
  saveClubData,
  loadPlayersForClub,
} from "../../../domain/clubStorage.js";
import { normalizePlayers } from "../../../models/player.js";
import { guardClubTenant } from "../../tenant/guards/tenantGuard.js";
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
} from "./clubGovernanceService.js";
import { getPickVnRatingByAuthUserId } from "../../pick-vn-rating/services/pickVnRatingService.js";
import { syncRatingToClubPlayer } from "../../pick-vn-rating/services/pickVnRatingService.js";
import { rpcReviewClubMembershipRequest } from "./clubMembershipRequestRpcService.js";

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

export function listJoinableClubs(tenantId) {
  return getClubsByTenant(tenantId).filter((club) => club.status === CLUB_STATUSES.ACTIVE);
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

export function listPendingMembershipRequests(clubId, tenantId, user = getCurrentUser()) {
  const club = getRegistryClubById(clubId);
  if (!club) {
    return [];
  }

  if (!canApproveClubMembershipRequests(user, club)) {
    return [];
  }

  if (tenantId) {
    const tenantCheck = guardClubTenant(clubId, tenantId);
    if (!tenantCheck.ok) {
      return [];
    }
  }

  const ext = loadClubExtension(clubId);
  return getMembershipRequests(ext).filter(
    (request) => request.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING
  );
}

export function submitClubMembershipRequest(clubId, tenantId, user, options = {}) {
  const trimmedClubId = String(clubId || "").trim();
  const trimmedTenantId = String(tenantId || "").trim();
  const athlete = user || getCurrentUser();

  if (!athlete?.id) {
    return { ok: false, error: "Chưa đăng nhập." };
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

  const tenantCheck = guardClubTenant(trimmedClubId, trimmedTenantId);
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
    tenantId: trimmedTenantId,
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

export function cancelClubMembershipRequest(clubId, requestId, userId) {
  const trimmedClubId = String(clubId || "").trim();
  const trimmedRequestId = String(requestId || "").trim();
  const trimmedUserId = String(userId || "").trim();

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

export async function approveClubMembershipRequest(clubId, requestId, tenantId, options = {}) {
  const user = options.user || getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canApproveClubMembershipRequests(user, club)) {
    return { ok: false, error: "Chỉ Chủ tịch / Phó chủ tịch / Chủ sở hữu CLB được duyệt." };
  }

  const tenantCheck = guardClubTenant(clubId, tenantId);
  if (!tenantCheck.ok) {
    return tenantCheck;
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

  const memberResult = addMemberToClub(clubId, playerResult.player.id, tenantId, {
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

export function rejectClubMembershipRequest(clubId, requestId, tenantId, options = {}) {
  const user = options.user || getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }

  if (!canApproveClubMembershipRequests(user, club)) {
    return { ok: false, error: "Chỉ Chủ tịch / Phó chủ tịch / Chủ sở hữu CLB được từ chối." };
  }

  const tenantCheck = guardClubTenant(clubId, tenantId);
  if (!tenantCheck.ok) {
    return tenantCheck;
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

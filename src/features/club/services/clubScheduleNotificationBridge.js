import { createLocalNotification } from "../../mobile/services/notificationService.js";
import { NOTIFICATION_TYPES } from "../../mobile/constants/notificationTypes.js";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import {
  CLUB_MEMBER_STATUSES,
  isClubMemberStatusActive,
} from "../constants/clubMemberRoles.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { getClubMembers } from "./clubMemberService.js";
import { rpcV2ClubListMembers } from "./clubStorageV2RpcService.js";
import { findUserIdByPlayerId } from "../storage/athleteClubLinkStore.js";

/**
 * Resolve auth user ids for active club members.
 * V2 ON: public.club_members via club_list_members (SSOT) — never blob.
 * V2 OFF: legacy extension roster + player auth links.
 */
async function listClubMemberAuthUserIds(clubId, tenantId) {
  if (isClubStorageV2Enabled()) {
    const result = await rpcV2ClubListMembers(clubId);
    if (!result.ok) {
      return [];
    }
    const userIds = new Set();
    for (const row of result.members || []) {
      if (!isClubMemberStatusActive(row?.status)) {
        continue;
      }
      const userId = String(row.user_id || "").trim();
      if (userId) {
        userIds.add(userId);
      }
    }
    return [...userIds];
  }

  const members = getClubMembers(clubId, tenantId, { skipGovernanceGuard: true }).filter(
    (member) => member.status === CLUB_MEMBER_STATUSES.ACTIVE
  );
  const players = loadPlayersForClub(clubId);
  const userIds = new Set();

  for (const member of members) {
    const player = players.find((item) => item.id === member.playerId);
    const userId = player?.authUserId || findUserIdByPlayerId(member.playerId);
    if (userId) {
      userIds.add(String(userId));
    }
  }

  return [...userIds];
}

const platformWriters = [];

export function registerClubNotificationWriter(writer) {
  if (typeof writer === "function" && !platformWriters.includes(writer)) {
    platformWriters.push(writer);
  }
}

async function emitNotification({ userId, tenantId, title, body, payload }) {
  const input = {
    userId,
    tenantId,
    type: NOTIFICATION_TYPES.CLUB_SCHEDULE,
    title,
    body,
    payload,
  };

  await createLocalNotification(input);

  for (const writer of platformWriters) {
    try {
      writer({
        tenant_id: tenantId,
        user_id: userId,
        title,
        body,
        channel: NOTIFICATION_TYPES.CLUB_SCHEDULE,
        payload_json: payload,
      });
    } catch {
      // ignore platform writer failures
    }
  }
}

export async function notifyClubMembers({
  clubId,
  tenantId,
  title,
  body,
  payload = {},
  excludeUserId = null,
}) {
  const userIds = await listClubMemberAuthUserIds(clubId, tenantId);
  for (const userId of userIds) {
    if (excludeUserId && String(userId) === String(excludeUserId)) {
      continue;
    }
    await emitNotification({
      userId,
      tenantId,
      title,
      body,
      payload: { clubId, ...payload },
    });
  }
  return { ok: true, count: userIds.length };
}

export async function notifyClubGovernanceChange({
  userId,
  tenantId,
  clubId,
  title,
  body,
  payload = {},
}) {
  if (!userId) {
    return { ok: false, error: "Thiếu userId." };
  }
  await emitNotification({
    userId,
    tenantId,
    title,
    body,
    payload: { clubId, ...payload },
  });
  return { ok: true };
}

/**
 * Club schedule notification bridge — Phase 1.2 pilot / Phase 1.5 retirement notes.
 *
 * CLUB_SCHEDULE_UPDATED goes to the canonical Notification Module only
 * (no parallel write to mobile local inbox for this path).
 *
 * @deprecated Dual-write to mobile inbox for schedule events is retired.
 * Governance notifications still use the legacy mobile path until migrated.
 */
import { createLocalNotification } from "../../mobile/services/notificationService.js";
import { NOTIFICATION_TYPES } from "../../mobile/constants/notificationTypes.js";
import { loadPlayersForClub } from "../../../domain/clubStorage.js";
import { CLUB_MEMBER_STATUSES } from "../constants/clubMemberRoles.js";
import { getClubMembers } from "./clubMemberService.js";
import { findUserIdByPlayerId } from "../storage/athleteClubLinkStore.js";
import {
  emitDomainNotificationEvent,
} from "../../notifications/services/domainNotificationAdapter.js";
import { NOTIFICATION_EVENT_TYPES } from "../../notifications/constants/notificationEvents.js";
import { buildNotificationIdempotencyKey } from "../../notifications/utils/idempotencyKey.js";

function listClubMemberAuthUserIds(clubId, tenantId) {
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

async function emitLegacyMobileNotification({ userId, tenantId, title, body, payload }) {
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

/**
 * Pilot: club schedule updates → canonical Notification Module.
 * Avoids dual-write to mobile local inbox for the same event.
 */
export async function notifyClubMembers({
  clubId,
  tenantId,
  title,
  body,
  payload = {},
  excludeUserId = null,
}) {
  if (!tenantId) {
    return { ok: false, error: "tenantId is required." };
  }

  let userIds = listClubMemberAuthUserIds(clubId, tenantId);
  if (excludeUserId) {
    userIds = userIds.filter((id) => String(id) !== String(excludeUserId));
  }

  const entityId = payload.sessionId || clubId;
  const version =
    payload.version ||
    payload.updatedAt ||
    payload.action ||
    "1";

  const idempotencyKey = buildNotificationIdempotencyKey({
    tenantId,
    eventType: NOTIFICATION_EVENT_TYPES.CLUB_SCHEDULE_UPDATED,
    entityId: String(entityId),
    version: String(version),
  });

  const result = await emitDomainNotificationEvent({
    tenantId,
    clubId,
    eventType: NOTIFICATION_EVENT_TYPES.CLUB_SCHEDULE_UPDATED,
    actorUserId: excludeUserId || null,
    idempotencyKey,
    recipientHints: { userIds },
    sourceEntityType: "club_activity_session",
    sourceEntityId: String(entityId),
    domainSource: "club-schedule-pilot",
    payload: {
      title: title || "Cập nhật lịch CLB",
      message: body || "Lịch sinh hoạt câu lạc bộ đã được cập nhật.",
      body,
      clubId,
      ...payload,
      sourceEntityType: "club_activity_session",
      sourceEntityId: String(entityId),
    },
  });

  return {
    ok: result.ok,
    count: result.createdCount || 0,
    outcome: result.outcome,
    duplicateCount: result.duplicateCount || 0,
    error: result.error,
    notifications: result.notifications || [],
  };
}

/** Legacy path — governance / non-schedule (not Phase 1.2 pilot). */
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
  await emitLegacyMobileNotification({
    userId,
    tenantId,
    title,
    body,
    payload: { clubId, ...payload },
  });
  return { ok: true };
}

/**
 * Internal draw/schedule operator lifecycle — one resolver, no circular lock/publish.
 *
 * DRAW_CONFIRMED = persisted groups (Chia bảng already durable).
 * DRAW_PUBLISHED remains a separate immutability state on Bốc thăm.
 * Internal schedule lock does not require draw publish.
 */
import { getDrawPublishStatus } from "../../../tournament/engines/publishDrawEngine.js";
import {
  SCHEDULE_PUBLISH_STATUS,
  canEditSchedule,
  getSchedulePublishStatus,
  lockSchedule as lockSharedSchedule,
  publishSchedule as publishSharedSchedule,
} from "../../../tournament/engines/publishScheduleEngine.js";
import { listInternalPersistedGroups } from "./internalPersistedDrawGroups.js";
import {
  INTERNAL_COURT_AVAILABILITY,
  INTERNAL_COURT_COPY,
  matchesHaveCourtAndTime,
} from "./internalScheduleCourts.js";

export const INTERNAL_SCHEDULE_ACTIONS = Object.freeze({
  CREATE: "create",
  ASSIGN_COURTS: "assign_courts",
  LOCK: "lock",
  PUBLISH: "publish",
  REOPEN: "reopen",
});

export function resolveInternalScheduleLifecycle({
  tournament = null,
  event = null,
  matches = [],
  courtsAvailable = 0,
  courtAvailability = null,
} = {}) {
  const groups = listInternalPersistedGroups(event || tournament);
  const draw = getDrawPublishStatus(tournament);
  const schedule = getSchedulePublishStatus(tournament);
  const matchList = Array.isArray(matches) ? matches : [];
  const hasMatches = matchList.length > 0;
  const courtsAssigned = matchesHaveCourtAndTime(matchList);
  const drawConfirmed = groups.length > 0;
  const scheduleLocked =
    schedule.status === SCHEDULE_PUBLISH_STATUS.LOCKED ||
    schedule.status === SCHEDULE_PUBLISH_STATUS.PUBLISHED;
  const schedulePublished = schedule.status === SCHEDULE_PUBLISH_STATUS.PUBLISHED;

  const create = (() => {
    if (!drawConfirmed) {
      return { enabled: false, reason: "Chia bảng trước khi tạo lịch." };
    }
    if (hasMatches) {
      return { enabled: false, reason: "Lịch trận đã tồn tại. Xếp sân/giờ nếu chưa gán." };
    }
    return { enabled: true, reason: "" };
  })();

  const assignCourts = (() => {
    if (!hasMatches) {
      return { enabled: false, reason: "Tạo lịch trận trước khi xếp sân." };
    }
    if (schedulePublished) {
      return { enabled: false, reason: "Lịch đã công bố, không thể chỉnh sửa." };
    }
    const availableCount = courtAvailability
      ? Number(courtAvailability.availableCount) || 0
      : Number(courtsAvailable) || 0;
    if (availableCount <= 0) {
      const noneConfigured =
        !courtAvailability ||
        courtAvailability.state === INTERNAL_COURT_AVAILABILITY.NONE_CONFIGURED;
      return {
        enabled: false,
        reason: noneConfigured
          ? INTERNAL_COURT_COPY[INTERNAL_COURT_AVAILABILITY.NONE_CONFIGURED]
          : INTERNAL_COURT_COPY[INTERNAL_COURT_AVAILABILITY.ALL_UNAVAILABLE],
      };
    }
    return { enabled: true, reason: "" };
  })();

  const lock = (() => {
    if (schedulePublished) {
      return { enabled: false, reason: "Lịch đã công bố." };
    }
    if (schedule.status === SCHEDULE_PUBLISH_STATUS.LOCKED) {
      return { enabled: false, reason: "Lịch đã được khóa." };
    }
    if (!hasMatches) {
      return { enabled: false, reason: "Tạo lịch trận trước khi khóa." };
    }
    if (!courtsAssigned) {
      return {
        enabled: false,
        reason: "Phân sân và giờ cho tất cả trận trước khi khóa lịch.",
      };
    }
    return { enabled: true, reason: "" };
  })();

  const publish = (() => {
    if (schedulePublished) {
      return { enabled: false, reason: "Lịch đã được công bố." };
    }
    if (schedule.status !== SCHEDULE_PUBLISH_STATUS.LOCKED) {
      return { enabled: false, reason: "Khóa lịch trước khi công bố." };
    }
    return { enabled: true, reason: "" };
  })();

  return {
    drawConfirmed,
    drawStatus: draw.status,
    drawPublished: draw.status === "published",
    scheduleStatus: schedule.status,
    scheduleLocked,
    schedulePublished,
    hasMatches,
    courtsAssigned,
    matchCount: matchList.length,
    actions: {
      [INTERNAL_SCHEDULE_ACTIONS.CREATE]: create,
      [INTERNAL_SCHEDULE_ACTIONS.ASSIGN_COURTS]: assignCourts,
      [INTERNAL_SCHEDULE_ACTIONS.LOCK]: lock,
      [INTERNAL_SCHEDULE_ACTIONS.PUBLISH]: publish,
    },
    circularLockPublish: false,
  };
}

export function lockInternalSchedule(tournament, matches = [], options = {}) {
  const lifecycle = resolveInternalScheduleLifecycle({
    tournament,
    event: tournament?.events?.[0],
    matches,
  });
  if (!lifecycle.actions.lock.enabled) {
    return { ok: false, error: lifecycle.actions.lock.reason };
  }
  const edit = canEditSchedule(tournament);
  if (!edit.ok) return edit;
  return lockSharedSchedule(tournament, matches, {
    ...options,
    requireDrawPublished: false,
  });
}

export function publishInternalSchedule(tournament, matches = [], options = {}) {
  const lifecycle = resolveInternalScheduleLifecycle({
    tournament,
    event: tournament?.events?.[0],
    matches,
  });
  if (!lifecycle.actions.publish.enabled) {
    return { ok: false, error: lifecycle.actions.publish.reason };
  }
  return publishSharedSchedule(tournament, matches, {
    ...options,
    requireDrawPublished: false,
  });
}

/**
 * S1-H — Player notifications derived from tournament blob / audit (read-only compose).
 * Types: match_assigned, schedule_changed, walkover_notice, result_published, tournament_completed.
 */

import { createId } from "../../../utils/id.js";
import { getResultsOps, RESULTS_OPS_AUDIT } from "./walkoverEngine.js";
import { getResultPropagationState, RESULT_AUDIT_ACTIONS } from "./matchResultEngine.js";
import { getSchedulePublishStatus, SCHEDULE_AUDIT_ACTIONS } from "../../../tournament/engines/publishScheduleEngine.js";
import { getRefereeAssignments } from "./refereeAssignEngine.js";
import { isTournamentClosed } from "./tournamentClosingEngine.js";

export const PLAYER_NOTIFICATION_TYPE = Object.freeze({
  MATCH_ASSIGNED: "match_assigned",
  SCHEDULE_CHANGED: "schedule_changed",
  WALKOVER_NOTICE: "walkover_notice",
  RESULT_PUBLISHED: "result_published",
  TOURNAMENT_COMPLETED: "tournament_completed",
});

const READ_CAP = 100;

function getNotificationState(tournament) {
  const raw = tournament?.settings?.playerNotifications || {};
  return {
    readIds: Array.isArray(raw.readIds) ? raw.readIds.map(String) : [],
    dismissedIds: Array.isArray(raw.dismissedIds) ? raw.dismissedIds.map(String) : [],
  };
}

function patchNotificationState(tournament, patch) {
  const current = getNotificationState(tournament);
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      playerNotifications: {
        ...current,
        ...patch,
      },
    },
  };
}

function involvesEntry(meta, entryId) {
  if (!entryId) return true;
  const id = String(entryId);
  if (meta.entryId && String(meta.entryId) === id) return true;
  if (meta.winnerId && String(meta.winnerId) === id) return true;
  if (meta.loserId && String(meta.loserId) === id) return true;
  if (meta.matchEntryAId && String(meta.matchEntryAId) === id) return true;
  if (meta.matchEntryBId && String(meta.matchEntryBId) === id) return true;
  return false;
}

/**
 * Build notification feed for a player entry (derived, stable ids).
 */
export function buildPlayerNotifications(tournament, options = {}) {
  const entryId = options.entryId ? String(options.entryId) : "";
  const state = getNotificationState(tournament);
  const items = [];

  // Match assigned (referee / court)
  const assignments = getRefereeAssignments(tournament);
  Object.values(assignments).forEach((assignment) => {
    if (!assignment?.matchId) return;
    const match = (tournament.events || [])
      .flatMap((e) => e.matches || [])
      .find((m) => String(m.id) === String(assignment.matchId));
    if (!match) return;
    if (
      entryId &&
      String(match.entryAId) !== entryId &&
      String(match.entryBId) !== entryId
    ) {
      return;
    }
    items.push({
      id: `notif-assign-${assignment.matchId}`,
      type: PLAYER_NOTIFICATION_TYPE.MATCH_ASSIGNED,
      title: "Trận đã được phân công",
      body: `Trọng tài ${assignment.refereeName || "đã gán"} · trận ${assignment.matchId}`,
      matchId: assignment.matchId,
      timestamp: assignment.assignedAt || null,
      severity: "info",
    });
  });

  // Schedule changed / published
  const schedule = getSchedulePublishStatus(tournament);
  (schedule.auditLog || []).forEach((entry) => {
    if (
      entry.action === SCHEDULE_AUDIT_ACTIONS.PUBLISHED ||
      entry.action === SCHEDULE_AUDIT_ACTIONS.FORCE_PUBLISH ||
      entry.action === "schedule_force_publish" ||
      entry.action === "schedule_published"
    ) {
      items.push({
        id: `notif-sched-${entry.id || entry.timestamp}`,
        type: PLAYER_NOTIFICATION_TYPE.SCHEDULE_CHANGED,
        title: "Lịch thi đấu đã cập nhật",
        body: "BTC đã công bố / chỉnh lịch. Kiểm tra giờ và sân của bạn.",
        timestamp: entry.timestamp || null,
        severity: "warning",
      });
    }
  });

  // Walkover notices
  const ops = getResultsOps(tournament);
  (ops.auditLog || []).forEach((entry) => {
    if (entry.action !== RESULTS_OPS_AUDIT.WALKOVER_DECLARED) return;
    if (!involvesEntry(entry, entryId) && entryId) {
      // also check meta
      if (!involvesEntry(entry.meta || {}, entryId) && String(entry.entryId) !== entryId) {
        return;
      }
    }
    items.push({
      id: `notif-wo-${entry.id}`,
      type: PLAYER_NOTIFICATION_TYPE.WALKOVER_NOTICE,
      title: "Thông báo walkover",
      body: entry.reason || "Một trận liên quan đã được tuyên bố walkover.",
      matchId: entry.matchId || "",
      timestamp: entry.timestamp || null,
      severity: "warning",
    });
  });

  // Results published / confirmed
  const propagation = getResultPropagationState(tournament);
  (propagation.auditLog || []).forEach((entry) => {
    if (
      entry.action !== RESULT_AUDIT_ACTIONS.CONFIRMED &&
      entry.action !== "result_confirmed"
    ) {
      return;
    }
    if (entryId && entry.winnerId !== entryId && entry.loserId !== entryId) {
      return;
    }
    items.push({
      id: `notif-result-${entry.id || entry.commandId}`,
      type: PLAYER_NOTIFICATION_TYPE.RESULT_PUBLISHED,
      title: "Kết quả đã công bố",
      body: `Trận ${entry.matchId || ""} · ${entry.scoreA ?? "—"}:${entry.scoreB ?? "—"}`,
      matchId: entry.matchId || "",
      timestamp: entry.timestamp || null,
      severity: "success",
    });
  });

  // Tournament completed
  if (isTournamentClosed(tournament) || ops.closed) {
    items.push({
      id: `notif-closed-${tournament.id}`,
      type: PLAYER_NOTIFICATION_TYPE.TOURNAMENT_COMPLETED,
      title: "Giải đã kết thúc",
      body: "Xem huy chương / giải thưởng trên cổng VĐV.",
      timestamp: ops.closedAt || null,
      severity: "success",
    });
  }

  const sorted = items
    .filter((item) => !state.dismissedIds.includes(String(item.id)))
    .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")))
    .map((item) => ({
      ...item,
      read: state.readIds.includes(String(item.id)),
    }));

  return {
    notifications: sorted,
    unreadCount: sorted.filter((n) => !n.read).length,
  };
}

export function markNotificationsRead(tournament, notificationIds = []) {
  const state = getNotificationState(tournament);
  const next = new Set(state.readIds);
  (notificationIds || []).forEach((id) => next.add(String(id)));
  return {
    ok: true,
    tournament: patchNotificationState(tournament, {
      readIds: [...next].slice(-READ_CAP),
    }),
  };
}

export function markAllNotificationsRead(tournament, options = {}) {
  const feed = buildPlayerNotifications(tournament, options);
  return markNotificationsRead(
    tournament,
    feed.notifications.map((n) => n.id)
  );
}

export function dismissNotification(tournament, notificationId) {
  const state = getNotificationState(tournament);
  const dismissed = new Set(state.dismissedIds);
  dismissed.add(String(notificationId));
  return {
    ok: true,
    tournament: patchNotificationState(tournament, {
      dismissedIds: [...dismissed].slice(-READ_CAP),
    }),
  };
}

/** Soft optimistic version bump for portal writes (S1-H). */
export function bumpPortalOptimisticVersion(tournament, expectedVersion) {
  const current = Number(tournament?.settings?.portalVersion || 0);
  if (expectedVersion != null && Number(expectedVersion) !== current) {
    return {
      ok: false,
      error: "Dữ liệu giải đã thay đổi (version conflict). Tải lại trang.",
      code: "VERSION_CONFLICT",
      currentVersion: current,
    };
  }
  return {
    ok: true,
    tournament: {
      ...tournament,
      settings: {
        ...(tournament.settings || {}),
        portalVersion: current + 1,
      },
    },
    version: current + 1,
  };
}

export function getPortalOptimisticVersion(tournament) {
  return Number(tournament?.settings?.portalVersion || 0);
}

export { createId };

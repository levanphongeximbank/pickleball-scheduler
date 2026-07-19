import { getCurrentUser } from "../../../auth/authService.js";
import { getClubById as getRegistryClubById } from "../../../domain/clubService.js";
import { guardClubTenant } from "../../tenant/guards/tenantGuard.js";
import {
  canApproveClubMembershipRequests,
  isClubPresident,
  isClubVicePresident,
} from "./clubGovernanceService.js";
import { getClubMembers } from "./clubMemberService.js";
import {
  createClubActivitySessionRecord,
  formatClubActivityDayLabel,
  normalizeClubActivitySession,
} from "../models/clubActivitySession.js";
import { loadClubExtension, saveClubExtension } from "../storage/clubExtensionStorage.js";
import { getClusterById } from "../../court-cluster/services/courtClusterService.js";
import { notifyClubMembers } from "./clubScheduleNotificationBridge.js";

function getActivitySessions(ext) {
  return (ext.activitySessions || [])
    .map((item) => normalizeClubActivitySession(item))
    .filter(Boolean)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

function saveActivitySessions(clubId, ext, sessions) {
  return saveClubExtension(clubId, {
    ...ext,
    activitySessions: sessions.map((item) => normalizeClubActivitySession(item)).filter(Boolean),
  });
}

export function canManageClubActivitySchedule(user, club) {
  if (!club || !user) {
    return false;
  }
  return (
    canApproveClubMembershipRequests(user, club) ||
    isClubPresident(user, club) ||
    isClubVicePresident(user, club)
  );
}

export function listClubActivitySessions(clubId, tenantId = null) {
  const club = getRegistryClubById(clubId);
  if (!club) {
    return [];
  }
  if (tenantId) {
    const tenantCheck = guardClubTenant(clubId, tenantId);
    if (!tenantCheck.ok) {
      return [];
    }
  }
  const ext = loadClubExtension(clubId);
  return getActivitySessions(ext);
}

export function getClubActivitySessionSummary(session, tenantId) {
  if (!session) {
    return null;
  }
  const cluster = session.clusterId ? getClusterById(session.clusterId, tenantId) : null;
  return {
    ...session,
    dayLabel: formatClubActivityDayLabel(session.dayOfWeek),
    clusterLabel: cluster?.name || session.clusterId || null,
  };
}

export function getTodayClubActivitySessions(clubId, tenantId = null, now = new Date()) {
  const isoDay = now.getDay() === 0 ? 7 : now.getDay();
  return listClubActivitySessions(clubId, tenantId)
    .filter((session) => session.dayOfWeek === isoDay)
    .map((session) => getClubActivitySessionSummary(session, tenantId));
}

export async function createClubActivitySession(clubId, tenantId, input = {}, options = {}) {
  const user = options.user || getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }
  if (!canManageClubActivitySchedule(user, club)) {
    return { ok: false, error: "Chỉ Chủ tịch / Phó chủ tịch được quản lý lịch sinh hoạt." };
  }

  const tenantCheck = guardClubTenant(clubId, tenantId);
  if (!tenantCheck.ok) {
    return tenantCheck;
  }

  const session = createClubActivitySessionRecord({
    clubId,
    tenantId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    clusterId: input.clusterId || null,
    note: input.note || "",
    createdBy: user?.id || null,
  });

  if (!session) {
    return { ok: false, error: "Dữ liệu lịch sinh hoạt không hợp lệ." };
  }

  const ext = loadClubExtension(clubId);
  const sessions = getActivitySessions(ext);
  saveActivitySessions(clubId, ext, [...sessions, session]);

  const summary = getClubActivitySessionSummary(session, tenantId);
  await notifyClubMembers({
    clubId,
    tenantId,
    excludeUserId: user?.id,
    title: "Lịch sinh hoạt CLB",
    body: `Đã thêm buổi sinh hoạt ${summary.dayLabel} ${summary.startTime}–${summary.endTime}.`,
    payload: {
      clubId,
      sessionId: session.id,
      action: "created",
      version: session.createdAt || session.id,
    },
  });

  return { ok: true, session: summary };
}

export async function updateClubActivitySession(clubId, sessionId, tenantId, input = {}, options = {}) {
  const user = options.user || getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }
  if (!canManageClubActivitySchedule(user, club)) {
    return { ok: false, error: "Chỉ Chủ tịch / Phó chủ tịch được quản lý lịch sinh hoạt." };
  }

  const tenantCheck = guardClubTenant(clubId, tenantId);
  if (!tenantCheck.ok) {
    return tenantCheck;
  }

  const ext = loadClubExtension(clubId);
  const sessions = getActivitySessions(ext);
  const index = sessions.findIndex((item) => item.id === sessionId);
  if (index < 0) {
    return { ok: false, error: "Không tìm thấy buổi sinh hoạt." };
  }

  const next = normalizeClubActivitySession(
    {
      ...sessions[index],
      ...input,
      id: sessions[index].id,
      clubId,
      tenantId,
      updatedAt: new Date().toISOString(),
    },
    { clubId, tenantId }
  );

  if (!next) {
    return { ok: false, error: "Dữ liệu lịch sinh hoạt không hợp lệ." };
  }

  const updated = sessions.map((item, i) => (i === index ? next : item));
  saveActivitySessions(clubId, ext, updated);

  const summary = getClubActivitySessionSummary(next, tenantId);
  await notifyClubMembers({
    clubId,
    tenantId,
    excludeUserId: user?.id,
    title: "Cập nhật lịch sinh hoạt",
    body: `Lịch ${summary.dayLabel} đã được cập nhật (${summary.startTime}–${summary.endTime}).`,
    payload: {
      clubId,
      sessionId: next.id,
      action: "updated",
      version: next.updatedAt || next.id,
    },
  });

  return { ok: true, session: summary };
}

export async function deleteClubActivitySession(clubId, sessionId, tenantId, options = {}) {
  const user = options.user || getCurrentUser();
  const club = getRegistryClubById(clubId);
  if (!club) {
    return { ok: false, error: "Không tìm thấy CLB." };
  }
  if (!canManageClubActivitySchedule(user, club)) {
    return { ok: false, error: "Chỉ Chủ tịch / Phó chủ tịch được quản lý lịch sinh hoạt." };
  }

  const tenantCheck = guardClubTenant(clubId, tenantId);
  if (!tenantCheck.ok) {
    return tenantCheck;
  }

  const ext = loadClubExtension(clubId);
  const sessions = getActivitySessions(ext);
  const target = sessions.find((item) => item.id === sessionId);
  if (!target) {
    return { ok: false, error: "Không tìm thấy buổi sinh hoạt." };
  }

  saveActivitySessions(
    clubId,
    ext,
    sessions.filter((item) => item.id !== sessionId)
  );

  const summary = getClubActivitySessionSummary(target, tenantId);
  await notifyClubMembers({
    clubId,
    tenantId,
    excludeUserId: user?.id,
    title: "Hủy buổi sinh hoạt",
    body: `Buổi sinh hoạt ${summary.dayLabel} ${summary.startTime}–${summary.endTime} đã bị hủy.`,
    payload: {
      clubId,
      sessionId: target.id,
      action: "deleted",
      version: `deleted:${target.id}`,
    },
  });

  return { ok: true, session: summary };
}

import { writeAuditLog } from "../../features/identity/services/auditService.js";
import { PERMISSIONS } from "../../features/identity/constants/permissions.js";
import { isDrawPublished } from "./publishDrawEngine.js";

export const SCHEDULE_PUBLISH_STATUS = {
  DRAFT: "draft",
  LOCKED: "locked",
  PUBLISHED: "published",
};

export const SCHEDULE_AUDIT_ACTIONS = Object.freeze({
  CREATED: "schedule_created",
  LOCKED: "schedule_locked",
  PUBLISHED: "schedule_published",
  REOPENED: "schedule_reopened",
  FORCE_PUBLISH: "schedule_force_publish",
});

const AUDIT_LOG_CAP = 50;

function patchScheduleSettings(tournament, schedulePatch) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      schedule: {
        ...(tournament.settings?.schedule || {}),
        ...schedulePatch,
      },
    },
  };
}

function cloneMatches(matches = []) {
  return JSON.parse(JSON.stringify(matches || []));
}

export function summarizeScheduleMatches(matches = []) {
  return (matches || []).map((match) => ({
    id: match.id,
    courtId: match.courtId || null,
    scheduledStart: match.scheduledStart || null,
    scheduledEnd: match.scheduledEnd || null,
    slot: match.slot ?? null,
    session: match.session || null,
    entryAId: match.entryAId || "",
    entryBId: match.entryBId || "",
    matchOrder: match.matchOrder ?? null,
  }));
}

export function normalizeSchedulePublish(state = {}) {
  const status = Object.values(SCHEDULE_PUBLISH_STATUS).includes(state.status)
    ? state.status
    : SCHEDULE_PUBLISH_STATUS.DRAFT;

  return {
    status,
    publishedAt: state.publishedAt || null,
    publishedBy: state.publishedBy ? String(state.publishedBy).trim() : "",
    lockedAt: state.lockedAt || null,
    lockedBy: state.lockedBy ? String(state.lockedBy).trim() : "",
    snapshot: state.snapshot || null,
    auditLog: Array.isArray(state.auditLog) ? state.auditLog : [],
    createdAt: state.createdAt || null,
    createdBy: state.createdBy ? String(state.createdBy).trim() : "",
    minRestMinutes:
      state.minRestMinutes != null ? Number(state.minRestMinutes) : undefined,
  };
}

export function getSchedulePublishStatus(tournament) {
  return normalizeSchedulePublish(tournament?.settings?.schedule || {});
}

export function isSchedulePublished(tournament) {
  return getSchedulePublishStatus(tournament).status === SCHEDULE_PUBLISH_STATUS.PUBLISHED;
}

export function isScheduleLocked(tournament) {
  const publish = getSchedulePublishStatus(tournament);
  return (
    publish.status === SCHEDULE_PUBLISH_STATUS.LOCKED ||
    publish.status === SCHEDULE_PUBLISH_STATUS.PUBLISHED
  );
}

export function canEditSchedule(tournament) {
  if (isSchedulePublished(tournament)) {
    return { ok: false, error: "Lịch đã công bố, không thể chỉnh sửa." };
  }
  return { ok: true };
}

export function canRegenerateSchedule(tournament) {
  return canEditSchedule(tournament);
}

function appendScheduleAuditEntry(tournament, entry, options = {}) {
  const publish = getSchedulePublishStatus(tournament);
  const auditEntry = {
    id: `schedule-audit-${Date.now()}-${publish.auditLog.length}`,
    action: entry.action,
    actor: entry.actor || null,
    actorId: entry.actor?.id || options.userId || "",
    actorEmail: entry.actor?.email || "",
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason || "",
    timestamp: options.now || new Date().toISOString(),
  };

  const auditLog = [...publish.auditLog, auditEntry].slice(-AUDIT_LOG_CAP);

  const next = patchScheduleSettings(tournament, {
    ...publish,
    auditLog,
  });

  void writeAuditLog({
    action: entry.action,
    resourceType: "tournament",
    resourceId: tournament?.id || "",
    clubId: options.clubId || tournament?.clubId || null,
    actor: entry.actor || null,
    metadata: {
      scheduleAction: entry.action,
      before: entry.before,
      after: entry.after,
      reason: entry.reason || "",
    },
  }).catch(() => {});

  return { tournament: next, auditEntry };
}

export function recordScheduleCreated(tournament, matches = [], options = {}) {
  const publish = getSchedulePublishStatus(tournament);
  const now = options.now || new Date().toISOString();
  const actorId = options.userId || options.actor?.id || "";

  const schedulePatch = {
    ...publish,
    status: SCHEDULE_PUBLISH_STATUS.DRAFT,
    createdAt: publish.createdAt || now,
    createdBy: publish.createdBy || actorId,
    publishedAt: null,
    publishedBy: "",
    lockedAt: null,
    lockedBy: "",
    snapshot: null,
    minRestMinutes:
      options.minRestMinutes != null
        ? Number(options.minRestMinutes)
        : publish.minRestMinutes,
  };

  let next = patchScheduleSettings(tournament, schedulePatch);
  const audited = appendScheduleAuditEntry(
    next,
    {
      action: SCHEDULE_AUDIT_ACTIONS.CREATED,
      actor: options.actor || null,
      before: options.before ?? null,
      after: summarizeScheduleMatches(matches),
      reason: options.reason || "schedule_generated",
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    auditEntry: audited.auditEntry,
  };
}

function matchesHaveSlots(matches = []) {
  const list = matches || [];
  if (list.length === 0) {
    return false;
  }
  return list.every((match) => match.scheduledStart);
}

export function canLockSchedule(tournament, matches = []) {
  const editCheck = canEditSchedule(tournament);
  if (!editCheck.ok) {
    return editCheck;
  }

  const publish = getSchedulePublishStatus(tournament);
  if (publish.status === SCHEDULE_PUBLISH_STATUS.LOCKED) {
    return { ok: false, error: "Lịch đã được khóa." };
  }

  if (!isDrawPublished(tournament)) {
    return { ok: false, error: "Cần công bố bốc thăm trước khi khóa lịch." };
  }

  if (!matches.length) {
    return { ok: false, error: "Chưa có trận để khóa lịch." };
  }

  if (!matchesHaveSlots(matches)) {
    return { ok: false, error: "Tất cả trận cần có thời gian trước khi khóa lịch." };
  }

  return { ok: true };
}

export function lockSchedule(tournament, matches = [], options = {}) {
  const validation = canLockSchedule(tournament, matches);
  if (!validation.ok) {
    return validation;
  }

  const now = options.now || new Date().toISOString();
  const actorId = options.userId || options.actor?.id || "";
  const publish = normalizeSchedulePublish({
    ...getSchedulePublishStatus(tournament),
    status: SCHEDULE_PUBLISH_STATUS.LOCKED,
    lockedAt: now,
    lockedBy: actorId,
  });

  let next = patchScheduleSettings(tournament, publish);
  const audited = appendScheduleAuditEntry(
    next,
    {
      action: SCHEDULE_AUDIT_ACTIONS.LOCKED,
      actor: options.actor || null,
      before: summarizeScheduleMatches(
        getSchedulePublishStatus(tournament).snapshot || matches
      ),
      after: summarizeScheduleMatches(matches),
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    schedulePublish: getSchedulePublishStatus(audited.tournament),
    auditEntry: audited.auditEntry,
  };
}

export function canPublishSchedule(tournament, matches = []) {
  const publish = getSchedulePublishStatus(tournament);

  if (publish.status === SCHEDULE_PUBLISH_STATUS.PUBLISHED) {
    return { ok: false, error: "Lịch đã được công bố." };
  }

  if (publish.status !== SCHEDULE_PUBLISH_STATUS.LOCKED) {
    return { ok: false, error: "Cần khóa lịch trước khi công bố." };
  }

  if (!isDrawPublished(tournament)) {
    return { ok: false, error: "Cần công bố bốc thăm trước khi công bố lịch." };
  }

  if (!matches.length) {
    return { ok: false, error: "Chưa có trận để công bố lịch." };
  }

  if (!matchesHaveSlots(matches)) {
    return { ok: false, error: "Còn trận chưa có thời gian thi đấu." };
  }

  return { ok: true };
}

export function publishSchedule(tournament, matches = [], options = {}) {
  const validation = canPublishSchedule(tournament, matches);
  if (!validation.ok) {
    return validation;
  }

  const now = options.now || new Date().toISOString();
  const actorId = options.userId || options.actor?.id || "";
  const snapshot = cloneMatches(matches);
  const beforeSummary = summarizeScheduleMatches(matches);

  const publish = normalizeSchedulePublish({
    ...getSchedulePublishStatus(tournament),
    status: SCHEDULE_PUBLISH_STATUS.PUBLISHED,
    publishedAt: now,
    publishedBy: actorId,
    snapshot,
  });

  let next = patchScheduleSettings(tournament, publish);
  const audited = appendScheduleAuditEntry(
    next,
    {
      action: SCHEDULE_AUDIT_ACTIONS.PUBLISHED,
      actor: options.actor || null,
      before: beforeSummary,
      after: summarizeScheduleMatches(snapshot),
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    schedulePublish: getSchedulePublishStatus(audited.tournament),
    snapshot,
    auditEntry: audited.auditEntry,
  };
}

export function canReopenSchedule(tournament, options = {}) {
  const publish = getSchedulePublishStatus(tournament);

  if (publish.status === SCHEDULE_PUBLISH_STATUS.DRAFT) {
    return { ok: false, error: "Lịch chưa khóa hoặc công bố." };
  }

  if (options.requirePermission !== false && !options.hasReopenPermission) {
    return {
      ok: false,
      error: "Chỉ chủ sở hữu hoặc Super Admin mới được mở lại lịch.",
      code: "REOPEN_FORBIDDEN",
    };
  }

  return { ok: true };
}

export function reopenSchedule(tournament, options = {}) {
  const validation = canReopenSchedule(tournament, options);
  if (!validation.ok) {
    return validation;
  }

  const publish = getSchedulePublishStatus(tournament);
  const previousSnapshot = publish.snapshot;

  const draft = normalizeSchedulePublish({
    ...publish,
    status: SCHEDULE_PUBLISH_STATUS.DRAFT,
    publishedAt: null,
    publishedBy: "",
    lockedAt: null,
    lockedBy: "",
    snapshot: null,
  });

  let next = patchScheduleSettings(tournament, draft);
  const audited = appendScheduleAuditEntry(
    next,
    {
      action: SCHEDULE_AUDIT_ACTIONS.REOPENED,
      actor: options.actor || null,
      before: summarizeScheduleMatches(previousSnapshot || []),
      after: null,
      reason: options.reason || "owner_reopen",
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    schedulePublish: getSchedulePublishStatus(audited.tournament),
    auditEntry: audited.auditEntry,
  };
}

export function canForceRepublishSchedule(tournament, options = {}) {
  if (!isSchedulePublished(tournament)) {
    return { ok: false, error: "Chỉ force republish khi lịch đã công bố." };
  }

  if (options.requirePermission !== false && !options.hasReopenPermission) {
    return {
      ok: false,
      error: "Chỉ chủ sở hữu hoặc Super Admin mới được công bố lại lịch sau publish.",
      code: "FORCE_REPUBLISH_FORBIDDEN",
    };
  }

  return { ok: true };
}

export function forceRepublishSchedule(tournament, options = {}) {
  const validation = canForceRepublishSchedule(tournament, options);
  if (!validation.ok) {
    return validation;
  }

  const publish = getSchedulePublishStatus(tournament);
  const previousSnapshot = publish.snapshot;

  const draft = normalizeSchedulePublish({
    ...publish,
    status: SCHEDULE_PUBLISH_STATUS.DRAFT,
    publishedAt: null,
    publishedBy: "",
    lockedAt: null,
    lockedBy: "",
    snapshot: null,
  });

  let next = patchScheduleSettings(tournament, draft);
  const audited = appendScheduleAuditEntry(
    next,
    {
      action: SCHEDULE_AUDIT_ACTIONS.FORCE_PUBLISH,
      actor: options.actor || null,
      before: summarizeScheduleMatches(previousSnapshot || []),
      after: null,
      reason: options.reason || "force_republish_after_publish",
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    schedulePublish: getSchedulePublishStatus(audited.tournament),
    auditEntry: audited.auditEntry,
  };
}

export function resolveScheduleReopenPermission({ canPermission, rbacEnabled, canIntervene }) {
  if (canIntervene) {
    return true;
  }
  if (!rbacEnabled) {
    return true;
  }
  return Boolean(
    canPermission?.(PERMISSIONS.TOURNAMENT_CERTIFY) ||
      canPermission?.(PERMISSIONS.TOURNAMENT_DELETE)
  );
}

export function getPublishedScheduleSnapshot(tournament) {
  const publish = getSchedulePublishStatus(tournament);
  if (publish.status !== SCHEDULE_PUBLISH_STATUS.PUBLISHED) {
    return null;
  }
  return publish.snapshot || null;
}

/**
 * Manual match ops: update court/time while schedule is editable.
 * Returns warnings for rest violations (soft) so organizer can override knowingly.
 */
export function rescheduleMatch(tournament, matches = [], matchId, patch = {}, options = {}) {
  const editCheck = canEditSchedule(tournament);
  if (!editCheck.ok) {
    return editCheck;
  }

  const index = (matches || []).findIndex((m) => String(m.id) === String(matchId));
  if (index < 0) {
    return { ok: false, error: "Không tìm thấy trận." };
  }

  const nextMatches = matches.map((match, i) => {
    if (i !== index) return match;
    return {
      ...match,
      ...patch,
      manualScheduleLock: patch.manualScheduleLock !== false,
      courtId: patch.courtId !== undefined ? patch.courtId : match.courtId,
      scheduledStart:
        patch.scheduledStart !== undefined ? patch.scheduledStart : match.scheduledStart,
      scheduledEnd: patch.scheduledEnd !== undefined ? patch.scheduledEnd : match.scheduledEnd,
      session: patch.session !== undefined ? patch.session : match.session,
    };
  });

  return {
    ok: true,
    matches: nextMatches,
    match: nextMatches[index],
    warnings: options.restWarnings || [],
  };
}

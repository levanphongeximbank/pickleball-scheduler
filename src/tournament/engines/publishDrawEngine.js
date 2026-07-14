import { writeAuditLog } from "../../features/identity/services/auditService.js";
import { PERMISSIONS } from "../../features/identity/constants/permissions.js";

export const DRAW_PUBLISH_STATUS = {
  DRAFT: "draft",
  LOCKED: "locked",
  PUBLISHED: "published",
};

export const DRAW_AUDIT_ACTIONS = Object.freeze({
  CREATED: "draw_created",
  LOCKED: "draw_locked",
  PUBLISHED: "draw_published",
  REOPENED: "draw_reopened",
  FORCE_REDRAW: "draw_force_redraw",
});

const AUDIT_LOG_CAP = 50;

function patchDrawSettings(tournament, drawPatch) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      draw: {
        ...(tournament.settings?.draw || {}),
        ...drawPatch,
      },
    },
  };
}

function cloneGroups(groups = []) {
  return JSON.parse(JSON.stringify(groups));
}

export function summarizeGroups(groups = []) {
  return (groups || []).map((group) => ({
    id: group.id,
    label: group.label || group.name || "",
    entryCount: (group.entries || []).length,
    entryIds: (group.entries || []).map((entry) => entry.id),
  }));
}

export function normalizeDrawPublish(state = {}) {
  const status = Object.values(DRAW_PUBLISH_STATUS).includes(state.status)
    ? state.status
    : DRAW_PUBLISH_STATUS.DRAFT;

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
  };
}

export function getDrawPublishStatus(tournament) {
  return normalizeDrawPublish(tournament?.settings?.draw || {});
}

export function isDrawPublished(tournament) {
  return getDrawPublishStatus(tournament).status === DRAW_PUBLISH_STATUS.PUBLISHED;
}

export function isDrawLocked(tournament) {
  const publish = getDrawPublishStatus(tournament);
  return (
    publish.status === DRAW_PUBLISH_STATUS.LOCKED ||
    publish.status === DRAW_PUBLISH_STATUS.PUBLISHED
  );
}

export function canEditDraw(tournament) {
  if (isDrawPublished(tournament)) {
    return { ok: false, error: "Bốc thăm đã công bố, không thể chỉnh sửa." };
  }
  return { ok: true };
}

export function canRegenerateDraw(tournament) {
  return canEditDraw(tournament);
}

function appendDrawAuditEntry(tournament, entry, options = {}) {
  const publish = getDrawPublishStatus(tournament);
  const auditEntry = {
    id: `draw-audit-${Date.now()}-${publish.auditLog.length}`,
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

  const next = patchDrawSettings(tournament, {
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
      drawAction: entry.action,
      before: entry.before,
      after: entry.after,
      reason: entry.reason || "",
    },
  }).catch(() => {});

  return { tournament: next, auditEntry };
}

export function recordDrawCreated(tournament, groups, options = {}) {
  const publish = getDrawPublishStatus(tournament);
  const now = options.now || new Date().toISOString();
  const actorId = options.userId || options.actor?.id || "";

  const drawPatch = {
    ...publish,
    status: DRAW_PUBLISH_STATUS.DRAFT,
    createdAt: publish.createdAt || now,
    createdBy: publish.createdBy || actorId,
    publishedAt: null,
    publishedBy: "",
    lockedAt: null,
    lockedBy: "",
    snapshot: null,
  };

  let next = patchDrawSettings(tournament, drawPatch);
  const audited = appendDrawAuditEntry(
    next,
    {
      action: DRAW_AUDIT_ACTIONS.CREATED,
      actor: options.actor || null,
      before: options.before ?? null,
      after: summarizeGroups(groups),
      reason: options.reason || "draw_generated",
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    auditEntry: audited.auditEntry,
  };
}

export function canLockDraw(tournament, groups = []) {
  const editCheck = canEditDraw(tournament);
  if (!editCheck.ok) {
    return editCheck;
  }

  const publish = getDrawPublishStatus(tournament);
  if (publish.status === DRAW_PUBLISH_STATUS.LOCKED) {
    return { ok: false, error: "Bốc thăm đã được khóa." };
  }

  if (!groups.length) {
    return { ok: false, error: "Chưa có bảng đấu để khóa." };
  }

  return { ok: true };
}

export function lockDraw(tournament, groups = [], options = {}) {
  const validation = canLockDraw(tournament, groups);
  if (!validation.ok) {
    return validation;
  }

  const now = options.now || new Date().toISOString();
  const actorId = options.userId || options.actor?.id || "";
  const publish = normalizeDrawPublish({
    ...getDrawPublishStatus(tournament),
    status: DRAW_PUBLISH_STATUS.LOCKED,
    lockedAt: now,
    lockedBy: actorId,
  });

  let next = patchDrawSettings(tournament, publish);
  const audited = appendDrawAuditEntry(
    next,
    {
      action: DRAW_AUDIT_ACTIONS.LOCKED,
      actor: options.actor || null,
      before: summarizeGroups(getDrawPublishStatus(tournament).snapshot || groups),
      after: summarizeGroups(groups),
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    drawPublish: getDrawPublishStatus(audited.tournament),
    auditEntry: audited.auditEntry,
  };
}

export function canPublishDraw(tournament, groups = []) {
  const publish = getDrawPublishStatus(tournament);

  if (publish.status === DRAW_PUBLISH_STATUS.PUBLISHED) {
    return { ok: false, error: "Bốc thăm đã được công bố." };
  }

  if (publish.status !== DRAW_PUBLISH_STATUS.LOCKED) {
    return { ok: false, error: "Cần khóa bốc thăm trước khi công bố." };
  }

  if (!groups.length) {
    return { ok: false, error: "Chưa có bảng đấu để công bố." };
  }

  return { ok: true };
}

export function publishDraw(tournament, groups = [], options = {}) {
  const validation = canPublishDraw(tournament, groups);
  if (!validation.ok) {
    return validation;
  }

  const now = options.now || new Date().toISOString();
  const actorId = options.userId || options.actor?.id || "";
  const snapshot = cloneGroups(groups);
  const beforeSummary = summarizeGroups(groups);

  const publish = normalizeDrawPublish({
    ...getDrawPublishStatus(tournament),
    status: DRAW_PUBLISH_STATUS.PUBLISHED,
    publishedAt: now,
    publishedBy: actorId,
    snapshot,
  });

  let next = patchDrawSettings(tournament, publish);
  const audited = appendDrawAuditEntry(
    next,
    {
      action: DRAW_AUDIT_ACTIONS.PUBLISHED,
      actor: options.actor || null,
      before: beforeSummary,
      after: summarizeGroups(snapshot),
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    drawPublish: getDrawPublishStatus(audited.tournament),
    snapshot,
    auditEntry: audited.auditEntry,
  };
}

export function canReopenDraw(tournament, options = {}) {
  const publish = getDrawPublishStatus(tournament);

  if (publish.status === DRAW_PUBLISH_STATUS.DRAFT) {
    return { ok: false, error: "Bốc thăm chưa khóa hoặc công bố." };
  }

  if (options.requirePermission !== false && !options.hasReopenPermission) {
    return {
      ok: false,
      error: "Chỉ chủ sở hữu hoặc Super Admin mới được mở lại bốc thăm.",
      code: "REOPEN_FORBIDDEN",
    };
  }

  return { ok: true };
}

export function reopenDraw(tournament, options = {}) {
  const validation = canReopenDraw(tournament, options);
  if (!validation.ok) {
    return validation;
  }

  const publish = getDrawPublishStatus(tournament);
  const previousSnapshot = publish.snapshot;

  const draft = normalizeDrawPublish({
    ...publish,
    status: DRAW_PUBLISH_STATUS.DRAFT,
    publishedAt: null,
    publishedBy: "",
    lockedAt: null,
    lockedBy: "",
    snapshot: null,
  });

  let next = patchDrawSettings(tournament, draft);
  const audited = appendDrawAuditEntry(
    next,
    {
      action: DRAW_AUDIT_ACTIONS.REOPENED,
      actor: options.actor || null,
      before: summarizeGroups(previousSnapshot || []),
      after: null,
      reason: options.reason || "owner_reopen",
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    drawPublish: getDrawPublishStatus(audited.tournament),
    auditEntry: audited.auditEntry,
  };
}

export function canForceRedraw(tournament, options = {}) {
  if (!isDrawPublished(tournament)) {
    return { ok: false, error: "Chỉ force redraw khi bốc thăm đã công bố." };
  }

  if (options.requirePermission !== false && !options.hasReopenPermission) {
    return {
      ok: false,
      error: "Chỉ chủ sở hữu hoặc Super Admin mới được bốc thăm lại sau công bố.",
      code: "FORCE_REDRAW_FORBIDDEN",
    };
  }

  return { ok: true };
}

export function forceRedrawDraw(tournament, options = {}) {
  const validation = canForceRedraw(tournament, options);
  if (!validation.ok) {
    return validation;
  }

  const publish = getDrawPublishStatus(tournament);
  const previousSnapshot = publish.snapshot;

  const draft = normalizeDrawPublish({
    ...publish,
    status: DRAW_PUBLISH_STATUS.DRAFT,
    publishedAt: null,
    publishedBy: "",
    lockedAt: null,
    lockedBy: "",
    snapshot: null,
  });

  let next = patchDrawSettings(tournament, draft);
  const audited = appendDrawAuditEntry(
    next,
    {
      action: DRAW_AUDIT_ACTIONS.FORCE_REDRAW,
      actor: options.actor || null,
      before: summarizeGroups(previousSnapshot || []),
      after: null,
      reason: options.reason || "force_redraw_after_publish",
    },
    options
  );

  return {
    ok: true,
    tournament: audited.tournament,
    drawPublish: getDrawPublishStatus(audited.tournament),
    auditEntry: audited.auditEntry,
  };
}

export function resolveDrawReopenPermission({ canPermission, rbacEnabled, canIntervene }) {
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

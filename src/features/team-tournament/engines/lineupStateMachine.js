import { LINEUP_STATUS, MATCHUP_STATUS, TEAM_AUDIT_ACTIONS } from "../constants.js";

/** Spec alias — persisted value remains `not_submitted`. */
export const LINEUP_STATUS_ALIAS = Object.freeze({
  not_started: LINEUP_STATUS.NOT_SUBMITTED,
});

export const LINEUP_ACTION = Object.freeze({
  SAVE_DRAFT: "save_draft",
  SUBMIT: "submit",
  LOCK: "lock",
  PUBLISH: "publish",
  RANDOMIZE: "randomize",
  WITHDRAW: "withdraw",
  OVERRIDE: "override",
  EXPIRE: "expire",
});

export const LINEUP_ACTOR_ROLE = Object.freeze({
  CAPTAIN: "captain",
  BTC: "btc",
  SYSTEM: "system",
  REFEREE: "referee",
  PLAYER: "player",
});

/** Extended statuses for TT-2 (withdrawn/overridden/expired may not exist in legacy rows). */
export const EXTENDED_LINEUP_STATUS = Object.freeze({
  WITHDRAWN: "withdrawn",
  OVERRIDDEN: "overridden",
  EXPIRED: "expired",
});

const ALL_LINEUP_STATUSES = new Set([
  ...Object.values(LINEUP_STATUS),
  ...Object.values(EXTENDED_LINEUP_STATUS),
]);

/** Statuses where captain/BTC cannot mutate selections. */
export const LINEUP_IMMUTABLE_STATUSES = new Set([
  LINEUP_STATUS.LOCKED,
  LINEUP_STATUS.PUBLISHED,
  EXTENDED_LINEUP_STATUS.WITHDRAWN,
  EXTENDED_LINEUP_STATUS.OVERRIDDEN,
  EXTENDED_LINEUP_STATUS.EXPIRED,
]);

/** Captain-editable before lock deadline. */
export const LINEUP_CAPTAIN_EDITABLE_STATUSES = new Set([
  LINEUP_STATUS.NOT_SUBMITTED,
  LINEUP_STATUS.DRAFT,
  LINEUP_STATUS.SUBMITTED,
]);

/**
 * Transition matrix row.
 * @typedef {object} LineupTransition
 * @property {string} action
 * @property {string[]} from
 * @property {string} to
 * @property {string[]} roles
 * @property {string} auditAction
 * @property {string} [note]
 */

/** @type {LineupTransition[]} */
export const LINEUP_TRANSITION_MATRIX = Object.freeze([
  {
    action: LINEUP_ACTION.SAVE_DRAFT,
    from: [
      LINEUP_STATUS.NOT_SUBMITTED,
      LINEUP_STATUS.DRAFT,
      LINEUP_STATUS.SUBMITTED,
    ],
    to: LINEUP_STATUS.DRAFT,
    roles: [LINEUP_ACTOR_ROLE.CAPTAIN, LINEUP_ACTOR_ROLE.BTC],
    auditAction: TEAM_AUDIT_ACTIONS.LINEUP_DRAFT,
    note: "Empty selections may remain not_submitted (caller decides).",
  },
  {
    action: LINEUP_ACTION.SUBMIT,
    from: [
      LINEUP_STATUS.NOT_SUBMITTED,
      LINEUP_STATUS.DRAFT,
      LINEUP_STATUS.SUBMITTED,
    ],
    to: LINEUP_STATUS.SUBMITTED,
    roles: [LINEUP_ACTOR_ROLE.CAPTAIN, LINEUP_ACTOR_ROLE.BTC],
    auditAction: TEAM_AUDIT_ACTIONS.LINEUP_SUBMIT,
  },
  {
    action: LINEUP_ACTION.LOCK,
    from: [
      LINEUP_STATUS.NOT_SUBMITTED,
      LINEUP_STATUS.DRAFT,
      LINEUP_STATUS.SUBMITTED,
    ],
    to: LINEUP_STATUS.LOCKED,
    roles: [LINEUP_ACTOR_ROLE.BTC, LINEUP_ACTOR_ROLE.SYSTEM],
    auditAction: TEAM_AUDIT_ACTIONS.LINEUP_LOCK,
  },
  {
    action: LINEUP_ACTION.RANDOMIZE,
    from: [LINEUP_STATUS.NOT_SUBMITTED, LINEUP_STATUS.DRAFT],
    to: LINEUP_STATUS.LOCKED,
    roles: [LINEUP_ACTOR_ROLE.BTC, LINEUP_ACTOR_ROLE.SYSTEM],
    auditAction: TEAM_AUDIT_ACTIONS.LINEUP_RANDOM,
  },
  {
    action: LINEUP_ACTION.OVERRIDE,
    from: [LINEUP_STATUS.LOCKED, LINEUP_STATUS.PUBLISHED],
    to: EXTENDED_LINEUP_STATUS.OVERRIDDEN,
    roles: [LINEUP_ACTOR_ROLE.BTC],
    auditAction: TEAM_AUDIT_ACTIONS.LINEUP_UPDATE,
    note: "TT-3 BTC override — requires reason + republish if was published.",
  },
  {
    action: LINEUP_ACTION.LOCK,
    from: [EXTENDED_LINEUP_STATUS.OVERRIDDEN],
    to: LINEUP_STATUS.LOCKED,
    roles: [LINEUP_ACTOR_ROLE.BTC, LINEUP_ACTOR_ROLE.SYSTEM],
    auditAction: TEAM_AUDIT_ACTIONS.LINEUP_LOCK,
    note: "TT-3 republish prep.",
  },
  {
    action: LINEUP_ACTION.PUBLISH,
    from: [LINEUP_STATUS.LOCKED, EXTENDED_LINEUP_STATUS.OVERRIDDEN],
    to: LINEUP_STATUS.PUBLISHED,
    roles: [LINEUP_ACTOR_ROLE.BTC],
    auditAction: TEAM_AUDIT_ACTIONS.LINEUP_PUBLISH,
    note: "TT-3 republish after override.",
  },
  {
    action: LINEUP_ACTION.WITHDRAW,
    from: [LINEUP_STATUS.DRAFT, LINEUP_STATUS.SUBMITTED],
    to: EXTENDED_LINEUP_STATUS.WITHDRAWN,
    roles: [LINEUP_ACTOR_ROLE.CAPTAIN, LINEUP_ACTOR_ROLE.BTC],
    auditAction: TEAM_AUDIT_ACTIONS.LINEUP_UPDATE,
  },
  {
    action: LINEUP_ACTION.EXPIRE,
    from: [
      LINEUP_STATUS.NOT_SUBMITTED,
      LINEUP_STATUS.DRAFT,
      LINEUP_STATUS.SUBMITTED,
    ],
    to: EXTENDED_LINEUP_STATUS.EXPIRED,
    roles: [LINEUP_ACTOR_ROLE.SYSTEM],
    auditAction: TEAM_AUDIT_ACTIONS.LINEUP_LOCK,
  },
]);

export function normalizeLineupStatus(status) {
  const raw = String(status || "").trim();
  if (!raw) {
    return LINEUP_STATUS.NOT_SUBMITTED;
  }
  if (raw === "not_started") {
    return LINEUP_STATUS.NOT_SUBMITTED;
  }
  return ALL_LINEUP_STATUSES.has(raw) ? raw : LINEUP_STATUS.NOT_SUBMITTED;
}

export function findLineupTransition(action, fromStatus) {
  const normalizedFrom = normalizeLineupStatus(fromStatus);
  return (
    LINEUP_TRANSITION_MATRIX.find(
      (row) =>
        row.action === action && row.from.includes(normalizedFrom)
    ) || null
  );
}

/**
 * @param {object} params
 * @param {string} params.action
 * @param {string} [params.fromStatus]
 * @param {string} params.actorRole
 * @param {object} [params.matchup]
 * @param {string|Date|null} [params.serverNow] — ISO string or Date; SoT for deadline
 * @param {object} [params.lineup]
 */
export function assertLineupTransitionAllowed({
  action,
  fromStatus = LINEUP_STATUS.NOT_SUBMITTED,
  actorRole,
  matchup = null,
  serverNow = null,
  lineup = null,
}) {
  const normalizedFrom = normalizeLineupStatus(fromStatus);
  const transition = findLineupTransition(action, normalizedFrom);

  if (!transition) {
    const normalizedFrom = normalizeLineupStatus(fromStatus);
    if (LINEUP_IMMUTABLE_STATUSES.has(normalizedFrom)) {
      return {
        ok: false,
        code: "LOCKED",
        error: "Đội hình đã khóa, không thể sửa.",
        fromStatus: normalizedFrom,
        action,
      };
    }
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      error: `Không thể ${action} từ trạng thái "${normalizedFrom}".`,
      fromStatus: normalizedFrom,
      action,
    };
  }

  if (!transition.roles.includes(actorRole)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Bạn không có quyền thực hiện thao tác này.",
      fromStatus: normalizedFrom,
      action,
      actorRole,
    };
  }

  const deadlineCheck = evaluateLineupDeadline({
    action,
    matchup,
    serverNow,
    lineup,
  });
  if (!deadlineCheck.ok) {
    return deadlineCheck;
  }

  if (
    action === LINEUP_ACTION.PUBLISH &&
    matchup?.status &&
    matchup.status !== MATCHUP_STATUS.LOCKED &&
    matchup.status !== MATCHUP_STATUS.PUBLISHED
  ) {
    return {
      ok: false,
      code: "MATCHUP_NOT_LOCKED",
      error: "Phải khóa đội hình trước khi công bố.",
      matchupStatus: matchup.status,
    };
  }

  return {
    ok: true,
    fromStatus: normalizedFrom,
    toStatus: transition.to,
    action,
    auditAction: transition.auditAction,
    actorRole,
  };
}

/**
 * Server-side deadline evaluation (use in RPC + client guard).
 * @param {object} params
 * @param {string} params.action
 * @param {object|null} [params.matchup]
 * @param {string|Date|null} [params.serverNow]
 * @param {object|null} [params.lineup]
 */
export function evaluateLineupDeadline({ action, matchup = null, serverNow = null, lineup = null }) {
  const nowMs = resolveServerTimeMs(serverNow);
  const lockAtMs = matchup?.lineupLockAt
    ? new Date(matchup.lineupLockAt).getTime()
    : null;

  const isPastDeadline = lockAtMs !== null && nowMs >= lockAtMs;
  const lineupLocked = lineup?.lockedAt || LINEUP_IMMUTABLE_STATUSES.has(lineup?.status);

  if (lineupLocked && (action === LINEUP_ACTION.SAVE_DRAFT || action === LINEUP_ACTION.SUBMIT)) {
    return {
      ok: false,
      code: "LOCKED",
      error: "Đội hình đã khóa, không thể sửa.",
      isPastDeadline,
      serverNow: new Date(nowMs).toISOString(),
    };
  }

  if (
    isPastDeadline &&
    (action === LINEUP_ACTION.SAVE_DRAFT || action === LINEUP_ACTION.SUBMIT || action === LINEUP_ACTION.WITHDRAW)
  ) {
    return {
      ok: false,
      code: "DEADLINE_PASSED",
      error: "Đã quá giờ khóa đội hình.",
      isPastDeadline: true,
      canSaveDraft: false,
      canSubmit: false,
      serverNow: new Date(nowMs).toISOString(),
      lineupLockAt: matchup?.lineupLockAt || null,
    };
  }

  return {
    ok: true,
    isPastDeadline,
    canSaveDraft: !isPastDeadline && !lineupLocked,
    canSubmit: !isPastDeadline && !lineupLocked,
    serverNow: new Date(nowMs).toISOString(),
    lineupLockAt: matchup?.lineupLockAt || null,
  };
}

function resolveServerTimeMs(serverNow) {
  if (serverNow instanceof Date) {
    return serverNow.getTime();
  }
  if (typeof serverNow === "string" && serverNow.trim()) {
    const parsed = new Date(serverNow).getTime();
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

export function canCaptainEditLineupStatus(status) {
  return LINEUP_CAPTAIN_EDITABLE_STATUSES.has(normalizeLineupStatus(status));
}

export function listAllowedActions({ fromStatus, actorRole, matchup, serverNow, lineup }) {
  return LINEUP_TRANSITION_MATRIX.filter((row) => row.roles.includes(actorRole))
    .filter((row) => row.from.includes(normalizeLineupStatus(fromStatus)))
    .filter((row) =>
      assertLineupTransitionAllowed({
        action: row.action,
        fromStatus,
        actorRole,
        matchup,
        serverNow,
        lineup,
      }).ok
    )
    .map((row) => row.action);
}

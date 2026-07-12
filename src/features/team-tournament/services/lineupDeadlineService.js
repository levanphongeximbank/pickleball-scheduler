import {
  LINEUP_ACTION,
  evaluateLineupDeadline,
} from "../engines/lineupStateMachine.js";

export const DEADLINE_STATUS = Object.freeze({
  BEFORE: "before",
  AT: "at",
  PAST: "past",
  LOCKED: "locked",
});

/**
 * Sync client display clock to server `now()` from get_setup / get_visible_lineups.
 * Display only — permissions must come from server flags.
 * @param {string|Date|null} serverTimeIso
 */
export function createServerClockSync(serverTimeIso) {
  const serverMs = parseTimeMs(serverTimeIso);
  if (serverMs == null) {
    return null;
  }
  const clientMsAtSync = Date.now();
  return {
    serverMsAtSync: serverMs,
    clientMsAtSync,
    source: typeof serverTimeIso === "string" ? serverTimeIso : new Date(serverMs).toISOString(),
  };
}

/** @param {ReturnType<typeof createServerClockSync>|null} sync */
export function getSyncedNowMs(sync) {
  if (!sync) {
    return Date.now();
  }
  return sync.serverMsAtSync + (Date.now() - sync.clientMsAtSync);
}

export function getSyncedNowIso(sync) {
  return new Date(getSyncedNowMs(sync)).toISOString();
}

function parseTimeMs(value) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Top-level + per-matchup deadline meta from get_setup RPC.
 * @param {object|null} setupResult
 */
export function mapSetupDeadlineMeta(setupResult) {
  if (!setupResult?.ok) {
    return null;
  }

  return {
    serverTime: setupResult.serverTime || null,
    lineupDeadline: setupResult.lineupDeadline || null,
    canSaveDraft: setupResult.canSaveDraft === true,
    canSubmit: setupResult.canSubmit === true,
    deadlineStatus: setupResult.deadlineStatus || DEADLINE_STATUS.LOCKED,
    viewerTeamId: setupResult.viewerTeamId || null,
    source: "server",
  };
}

/**
 * Resolve captain lineup permissions for a matchup card.
 * Cloud primary: server flags only. Blob: state-machine fallback.
 */
export function resolveMatchupLineupPermissions({
  matchup,
  lineup = null,
  isCloudPrimary = false,
  serverClock = null,
}) {
  const lineupDeadline = matchup?.lineupDeadline ?? matchup?.lineupLockAt ?? null;

  if (
    isCloudPrimary &&
    (typeof matchup?.canSaveDraft === "boolean" || typeof matchup?.canSubmit === "boolean")
  ) {
    return {
      lineupDeadline,
      canSaveDraft: matchup.canSaveDraft === true,
      canSubmit: matchup.canSubmit === true,
      deadlineStatus: matchup.deadlineStatus || DEADLINE_STATUS.LOCKED,
      source: "server",
    };
  }

  const serverNow = getSyncedNowIso(serverClock);
  const draftEval = evaluateLineupDeadline({
    action: LINEUP_ACTION.SAVE_DRAFT,
    matchup,
    lineup,
    serverNow,
  });
  const submitEval = evaluateLineupDeadline({
    action: LINEUP_ACTION.SUBMIT,
    matchup,
    lineup,
    serverNow,
  });

  let deadlineStatus = DEADLINE_STATUS.BEFORE;
  if (draftEval.isPastDeadline || submitEval.isPastDeadline) {
    deadlineStatus = DEADLINE_STATUS.PAST;
  }
  if (!draftEval.ok && draftEval.code === "LOCKED") {
    deadlineStatus = DEADLINE_STATUS.LOCKED;
  }

  const nowMs = getSyncedNowMs(serverClock);
  const lockMs = lineupDeadline ? new Date(lineupDeadline).getTime() : null;
  if (lockMs != null && nowMs >= lockMs && nowMs < lockMs + 1000) {
    deadlineStatus = DEADLINE_STATUS.AT;
  }

  return {
    lineupDeadline,
    canSaveDraft: draftEval.canSaveDraft === true,
    canSubmit: submitEval.canSubmit === true,
    deadlineStatus,
    source: "blob",
  };
}

export function matchupNeedsLineupAction({ permissions, lineupStatus }) {
  if (!permissions?.canSaveDraft && !permissions?.canSubmit) {
    return false;
  }
  return (
    lineupStatus === "not_submitted" ||
    lineupStatus === "draft" ||
    lineupStatus === "submitted"
  );
}

export function isDeadlineElapsed({ lineupDeadline, syncedNowMs }) {
  if (!lineupDeadline) {
    return false;
  }
  return syncedNowMs >= new Date(lineupDeadline).getTime();
}

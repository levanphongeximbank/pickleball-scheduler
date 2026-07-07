import { EVENT_TYPE } from "../constants/statuses.js";
import { generateCourtAssignments, confirmAssignments } from "../engines/autoCourtAssignmentEngine.js";
import { guardAnyClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { COURT_ENGINE_PERMISSIONS } from "../guards/courtEngineGuard.js";
import {
  checkInPlayer,
  cancelCheckIn,
  markNoShow,
} from "./checkInService.js";
import {
  createSession,
  getActiveSession,
  openSession,
  closeSession,
  persistSession,
  getSessionSummary,
} from "./courtSessionService.js";
import { appendEvent } from "./eventLogService.js";
import {
  addToQueue,
  removeFromQueue,
  setQueuePriority,
  setQueueLocked,
  getActiveQueueEntries,
} from "./queueService.js";
import {
  startMatchTimer,
  pauseMatchTimer,
  resumeMatchTimer,
  endMatchTimer,
  getMatchElapsedMinutes,
  resolveTimerStatus,
} from "./courtTimerService.js";
import {
  transferAssignment,
  setCourtLocked,
  setCourtMaintenance,
} from "./courtTransferService.js";
import {
  assignRefereeToCourt,
  releaseRefereeFromCourt,
  buildRefereeRosterFromStaff,
} from "./refereeDispatchService.js";

function guardSchedulingAction(clubId, options = {}) {
  return guardAnyClubAction(
    clubId,
    [
      PERMISSIONS.SCHEDULING_RUN,
      PERMISSIONS.DIRECTOR_USE,
      COURT_ENGINE_PERMISSIONS.USE,
      COURT_ENGINE_PERMISSIONS.MANAGE,
    ],
    {},
    options
  );
}

function guardTransferAction(clubId, options = {}) {
  return guardAnyClubAction(
    clubId,
    [
      COURT_ENGINE_PERMISSIONS.TRANSFER,
      PERMISSIONS.COURT_UPDATE,
      COURT_ENGINE_PERMISSIONS.MANAGE,
    ],
    {},
    options
  );
}

function applyAction(clubId, session, result) {
  if (!result.ok) {
    return result;
  }
  let next = result.session;
  if (result.event) {
    next = appendEvent(next, result.event);
  }
  return persistSession(clubId, next);
}

export {
  createSession,
  getActiveSession,
  openSession,
  closeSession,
  getSessionSummary,
  generateCourtAssignments,
  getActiveQueueEntries,
  getMatchElapsedMinutes,
  resolveTimerStatus,
  buildRefereeRosterFromStaff,
};

export function previewAutoAssign(session, context = {}) {
  const queueEntries = getActiveQueueEntries(session);
  const result = generateCourtAssignments({
    sessionId: session.id,
    courts: context.courts || [],
    queueEntries,
    players: context.players || [],
    activeAssignments: session.assignments || [],
    matchHistory: context.matchHistory || [],
    refereeList: context.refereeList || [],
    activeRefereeAssignments: session.refereeAssignments || [],
    courtStates: session.courtStates || {},
    config: session.config || {},
    lockedPlayerIds: queueEntries.filter((item) => item.locked).map((item) => item.playerId),
  });

  return {
    ...result,
    previewOnly: true,
  };
}

export function confirmAutoAssign(clubId, session, proposedAssignments, actor = null) {
  const access = guardSchedulingAction(clubId);
  if (!access.ok) {
    return access;
  }

  const confirmResult = confirmAssignments(session, proposedAssignments, { actor });
  let next = appendEvent(confirmResult.session, {
    eventType: EVENT_TYPE.AUTO_ASSIGN_CONFIRM,
    message: `Xác nhận ${proposedAssignments.length} trận auto assignment`,
    createdBy: actor,
    metadata: { count: proposedAssignments.length },
  });
  return persistSession(clubId, next);
}

export function performCheckIn(clubId, session, playerId, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  const result = checkInPlayer(session, playerId, options);
  if (!result.ok) return result;
  return applyAction(clubId, session, { ok: true, session: result.session, event: result.event });
}

export function performCancelCheckIn(clubId, session, playerId, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  const result = cancelCheckIn(session, playerId, options);
  if (!result.ok) return result;
  return applyAction(clubId, session, { ok: true, session: result.session, event: result.event });
}

export function performNoShow(clubId, session, playerId, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  const result = markNoShow(session, playerId, options);
  if (!result.ok) return result;
  return applyAction(clubId, session, { ok: true, session: result.session, event: result.event });
}

export function performAddToQueue(clubId, session, playerId, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  const result = addToQueue(session, playerId, options);
  if (!result.ok) return result;
  return applyAction(clubId, session, { ok: true, session: result.session, event: result.event });
}

export function performRemoveFromQueue(clubId, session, playerId, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  const result = removeFromQueue(session, playerId, options);
  if (!result.ok) return result;
  return applyAction(clubId, session, { ok: true, session: result.session, event: result.event });
}

export function performSetPriority(clubId, session, playerId, priority, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  const result = setQueuePriority(session, playerId, priority, options);
  if (!result.ok) return result;
  return applyAction(clubId, session, { ok: true, session: result.session, event: result.event });
}

export function performSetQueueLocked(clubId, session, playerId, locked) {
  const access = guardSchedulingAction(clubId);
  if (!access.ok) {
    return access;
  }

  const result = setQueueLocked(session, playerId, locked);
  if (!result.ok) return result;
  return persistSession(clubId, result.session);
}

export function performStartMatch(clubId, session, assignmentId, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  return applyAction(clubId, session, startMatchTimer(session, assignmentId, options));
}

export function performPauseMatch(clubId, session, assignmentId, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  return applyAction(clubId, session, pauseMatchTimer(session, assignmentId, options));
}

export function performResumeMatch(clubId, session, assignmentId, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  return applyAction(clubId, session, resumeMatchTimer(session, assignmentId, options));
}

export function performEndMatch(clubId, session, assignmentId, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  return applyAction(clubId, session, endMatchTimer(session, assignmentId, options));
}

export function performTransfer(clubId, session, assignmentId, toCourtId, options = {}) {
  const access = guardTransferAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  return applyAction(clubId, session, transferAssignment(session, assignmentId, toCourtId, options));
}

export function performCourtLock(clubId, session, courtId, locked, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  return applyAction(clubId, session, setCourtLocked(session, courtId, locked, options));
}

export function performCourtMaintenance(clubId, session, courtId, maintenance, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  return applyAction(clubId, session, setCourtMaintenance(session, courtId, maintenance, options));
}

export function performAssignReferee(clubId, session, payload, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  return applyAction(clubId, session, assignRefereeToCourt(session, payload, options));
}

export function performReleaseReferee(clubId, session, courtId, options = {}) {
  const access = guardSchedulingAction(clubId, options);
  if (!access.ok) {
    return access;
  }

  return applyAction(clubId, session, releaseRefereeFromCourt(session, courtId, options));
}

export function logAutoAssignPreview(clubId, session, preview, actor = null) {
  const next = appendEvent(session, {
    eventType: EVENT_TYPE.AUTO_ASSIGN_PREVIEW,
    message: `Preview auto assignment: ${preview.assignments?.length || 0} đề xuất`,
    createdBy: actor,
    metadata: { warnings: preview.warnings },
  });
  return persistSession(clubId, next);
}

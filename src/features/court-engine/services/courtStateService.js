import { ASSIGNMENT_STATUS, COURT_RUNTIME_STATUS } from "../constants/statuses.js";

export const BUSY_ASSIGNMENT_STATUSES = Object.freeze([
  ASSIGNMENT_STATUS.ASSIGNED,
  ASSIGNMENT_STATUS.PLAYING,
  ASSIGNMENT_STATUS.PAUSED,
  ASSIGNMENT_STATUS.OVERRUN,
]);

export const BUSY_COURT_RUNTIME_STATUSES = Object.freeze([
  COURT_RUNTIME_STATUS.ASSIGNED,
  COURT_RUNTIME_STATUS.PLAYING,
  COURT_RUNTIME_STATUS.PAUSED,
  COURT_RUNTIME_STATUS.OVERRUN,
]);

export function normalizeCourtId(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function collectBusyCourtIds(courtStates = {}, activeAssignments = []) {
  const busy = new Set();

  (activeAssignments || []).forEach((assignment) => {
    if (BUSY_ASSIGNMENT_STATUSES.includes(assignment.status)) {
      busy.add(normalizeCourtId(assignment.courtId));
    }
  });

  Object.entries(courtStates || {}).forEach(([courtId, state]) => {
    if (state && BUSY_COURT_RUNTIME_STATUSES.includes(state.status)) {
      busy.add(normalizeCourtId(courtId));
    }
  });

  return busy;
}

export function assignmentStatusToCourtRuntime(status) {
  switch (status) {
    case ASSIGNMENT_STATUS.ASSIGNED:
      return COURT_RUNTIME_STATUS.ASSIGNED;
    case ASSIGNMENT_STATUS.PLAYING:
      return COURT_RUNTIME_STATUS.PLAYING;
    case ASSIGNMENT_STATUS.PAUSED:
      return COURT_RUNTIME_STATUS.PAUSED;
    case ASSIGNMENT_STATUS.OVERRUN:
      return COURT_RUNTIME_STATUS.OVERRUN;
    default:
      return COURT_RUNTIME_STATUS.EMPTY;
  }
}

export function patchCourtState(courtStates, courtId, patch) {
  const id = normalizeCourtId(courtId);
  return {
    ...courtStates,
    [id]: {
      ...(courtStates[id] || {}),
      ...patch,
    },
  };
}

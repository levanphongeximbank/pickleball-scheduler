export const SESSION_STATUS = Object.freeze({
  DRAFT: "draft",
  OPEN: "open",
  CLOSED: "closed",
});

export const SESSION_TYPE = Object.freeze({
  SOCIAL: "social",
  CLUB: "club",
  INTERNAL: "internal",
  OFFICIAL: "official",
});

export const PLAYER_SESSION_STATUS = Object.freeze({
  CHECKED_IN: "checked_in",
  WAITING: "waiting",
  PLAYING: "playing",
  RESTING: "resting",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
  CANCELLED: "cancelled",
});

export const QUEUE_STATUS = Object.freeze({
  ACTIVE: "active",
  HIDDEN: "hidden",
  REMOVED: "removed",
});

export const ASSIGNMENT_STATUS = Object.freeze({
  PROPOSED: "proposed",
  ASSIGNED: "assigned",
  PLAYING: "playing",
  PAUSED: "paused",
  OVERRUN: "overrun",
  COMPLETED: "completed",
});

export const COURT_RUNTIME_STATUS = Object.freeze({
  EMPTY: "empty",
  ASSIGNED: "assigned",
  PLAYING: "playing",
  PAUSED: "paused",
  OVERRUN: "overrun",
  COMPLETED: "completed",
  MAINTENANCE: "maintenance",
  LOCKED: "locked",
});

export const REFEREE_STATUS = Object.freeze({
  AVAILABLE: "available",
  ASSIGNED: "assigned",
  BUSY: "busy",
  OFFLINE: "offline",
});

export const EVENT_TYPE = Object.freeze({
  SESSION_CREATE: "session_create",
  SESSION_OPEN: "session_open",
  SESSION_CLOSE: "session_close",
  CHECK_IN: "check_in",
  CHECK_IN_CANCEL: "check_in_cancel",
  NO_SHOW: "no_show",
  QUEUE_ADD: "queue_add",
  QUEUE_REMOVE: "queue_remove",
  QUEUE_PRIORITY: "queue_priority",
  AUTO_ASSIGN_PREVIEW: "auto_assign_preview",
  AUTO_ASSIGN_CONFIRM: "auto_assign_confirm",
  MANUAL_ASSIGN: "manual_assign",
  REFEREE_ASSIGN: "referee_assign",
  MATCH_START: "match_start",
  MATCH_PAUSE: "match_pause",
  MATCH_RESUME: "match_resume",
  MATCH_END: "match_end",
  COURT_TRANSFER: "court_transfer",
  COURT_LOCK: "court_lock",
  COURT_UNLOCK: "court_unlock",
  COURT_MAINTENANCE: "court_maintenance",
});

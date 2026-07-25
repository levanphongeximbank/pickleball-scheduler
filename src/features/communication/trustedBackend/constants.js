/**
 * COMMS-ACT-05 — Trusted backend constants (no secrets).
 */

export const COMMUNICATION_TRUSTED_BACKEND_HOST = Object.freeze({
  family: "vercel_serverless_api",
  basePath: "/api/communication",
  commandPath: "/api/communication/command",
  systemProducePath: "/api/communication/system-produce",
  mirrorPattern: "api/identity/*",
  rejectedHosts: Object.freeze([
    "api/v1",
    "supabase/functions/rating-v5-*",
    "supabase/functions/referee-v5-*",
    "browser_service_role",
  ]),
});

export const COMMUNICATION_TRUSTED_COMMAND = Object.freeze({
  OPEN_OR_RESOLVE_DIRECT: "open_or_resolve_direct",
  SEND_DIRECT_MESSAGE: "send_direct_message",
  MARK_DIRECT_READ: "mark_direct_read",
  SEND_CLUB_MESSAGE: "send_club_message",
  PIN_CLUB_MESSAGE: "pin_club_message",
  UNPIN_CLUB_MESSAGE: "unpin_club_message",
  ADD_CLUB_PARTICIPANT: "add_club_participant",
  SUSPEND_CLUB_PARTICIPANT: "suspend_club_participant",
  REMOVE_CLUB_PARTICIPANT: "remove_club_participant",
  CHANGE_CLUB_PARTICIPANT_ROLE: "change_club_participant_role",
  REPORT_CLUB_MESSAGE: "report_club_message",
  CREATE_OR_RESOLVE_DEFAULT_CLUB_CHANNELS:
    "create_or_resolve_default_club_channels",
  COMMUNITY_ANY: "community_any",
});

export const COMMUNICATION_TRUSTED_COMMAND_VALUES = Object.freeze(
  Object.values(COMMUNICATION_TRUSTED_COMMAND)
);

/** Canonical System producer identity — never an end-user auth.uid(). */
export const COMMUNICATION_SYSTEM_PRODUCER_ID = "system:trusted-producer";

export const COMMUNICATION_SYSTEM_ALLOWED_SOURCES = Object.freeze([
  "notification_intent",
  "subscription_reminder",
  "tournament_ops",
  "identity_security",
  "comms_act_05_smoke",
]);

export const COMMUNICATION_ACT05_CAPABILITY_STATE = Object.freeze({
  DIRECT_TRUSTED_BACKEND: "DIRECT_TRUSTED_BACKEND",
  SYSTEM_TRUSTED_PRODUCER: "SYSTEM_TRUSTED_PRODUCER",
  CLUB_SELECT_CLIENT_RLS: "CLUB_SELECT_CLIENT_RLS",
  CLUB_WRITE_ADMIN_TRUSTED_BACKEND: "CLUB_WRITE_ADMIN_TRUSTED_BACKEND",
  COMMUNITY_BLOCKED_FAIL_CLOSED: "COMMUNITY_BLOCKED_FAIL_CLOSED",
  REALTIME_BLOCKED_FAIL_CLOSED: "REALTIME_BLOCKED_FAIL_CLOSED",
  PRODUCTION_UNTOUCHED: "PRODUCTION_UNTOUCHED",
});

export const COMMUNICATION_SMOKE_FIXTURE_MARKER = "COMMS_ACT_05_SMOKE_FIXTURE_";

export const COMMUNICATION_TRUSTED_BACKEND_ENV = Object.freeze({
  SYSTEM_PRODUCER_KEY: "COMMS_SYSTEM_PRODUCER_KEY",
  OWNER_GO: "COMMS_ACT_05_STAGING_OWNER_GO",
  OWNER_GO_TOKEN: "OWNER GO COMMS-ACT-05 STAGING TRUSTED_BACKEND_SMOKE_ONLY",
  BACKUP_EVIDENCE: "COMMS_ACT_05_STAGING_BACKUP_EVIDENCE",
  TARGET_CONFIRM: "COMMS_STAGING_TARGET_CONFIRM",
  /** Browser opt-in — never enables DEMO; only wires HTTP production gateway. */
  VITE_TRUSTED_BACKEND: "VITE_COMMUNICATION_TRUSTED_BACKEND",
});

/** Marker string for server-only modules — imported by boundary tests. */
export const COMMUNICATION_SERVER_ONLY_BOUNDARY =
  "COMMUNICATION_SERVER_ONLY_BOUNDARY";

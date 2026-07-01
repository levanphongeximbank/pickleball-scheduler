import { ROLES } from "../../identity/constants/roles.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";

/** Feature flag — mặc định tắt, không ảnh hưởng màn hình cũ. */
export function isAiEngineEnabled() {
  return String(import.meta.env?.VITE_ENABLE_AI_ENGINE || "").toLowerCase() === "true";
}

export const AI_SUGGESTION_TYPE = Object.freeze({
  SEED: "seed",
  PAIRING: "pairing",
  GROUP: "group",
  TIME_PREDICTION: "time_prediction",
  SCHEDULE_VALIDATION: "schedule_validation",
  RULE_SUGGESTION: "rule_suggestion",
});

export const AI_SUGGESTION_STATUS = Object.freeze({
  PENDING: "pending",
  APPLIED: "applied",
  DISMISSED: "dismissed",
  EXPIRED: "expired",
});

export const AI_CONFIDENCE = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
});

export const GROUP_SUGGESTION_MODE = Object.freeze({
  MANUAL_REVIEW: "manual_review",
  LIGHT_RANDOM: "light_random",
  COMPETITIVE_BALANCED: "competitive_balanced",
});

export const PAIRING_STRATEGY = Object.freeze({
  BALANCED: "balanced",
  SAME_LEVEL: "same_level",
  MIXED_GENDER: "mixed_gender",
  AVOID_REPEAT: "avoid_repeat",
  LIGHT_RANDOM: "light_random",
});

export const SCHEDULE_ISSUE_SEVERITY = Object.freeze({
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info",
});

/** Roles được dùng AI management (spec Sprint 7). */
export const AI_MANAGEMENT_ROLES = new Set([
  ROLES.SUPER_ADMIN,
  ROLES.COURT_OWNER,
  "TENANT_OWNER",
  ROLES.CLUB_OWNER,
  ROLES.COURT_MANAGER,
  "TOURNAMENT_MANAGER",
]);

/** REFEREE chỉ xem cảnh báo, không apply. */
export const AI_VIEW_ONLY_ROLES = new Set([ROLES.REFEREE]);

export const AI_PERMISSION = PERMISSIONS.TOURNAMENT_UPDATE;

export const AI_SUGGESTION_TTL_HOURS = 24;

export const AI_AUDIT_ACTIONS = Object.freeze({
  APPLIED: "AI_SUGGESTION_APPLIED",
  DISMISSED: "AI_SUGGESTION_DISMISSED",
});

export const DEFAULT_TIME_FORMULA = Object.freeze({
  baseMatchMinutes: 15,
  bufferMinutes: 4,
  openingBuffer: 12,
  knockoutBuffer: 15,
  delayBufferPercent: 0.15,
});

/**
 * Pilot-aligned shadow route authorization for /player/skill-assessment-v5 (Phase 4 OD-B03).
 * Uses existing Rating V5 access / enrollment authority — no parallel auth source.
 */
import { normalizeRole, ROLES } from "../../../auth/roles.js";
import { isPickVnRatingV5Enabled } from "../config/flags.js";
import { resolveRatingV5Access } from "./ratingV5AccessService.js";

export const SKILL_ASSESSMENT_V5_PATH = "/player/skill-assessment-v5";

export function isSkillAssessmentV5Path(pathname) {
  if (!pathname) return false;
  const path = String(pathname).split("?")[0];
  return path === SKILL_ASSESSMENT_V5_PATH || path.startsWith(`${SKILL_ASSESSMENT_V5_PATH}/`);
}

export function isSkillAssessmentV5AdminRole(role) {
  const normalized = normalizeRole(role);
  return (
    normalized === ROLES.PLATFORM_ADMIN ||
    normalized === ROLES.SUPER_ADMIN ||
    String(role || "").toUpperCase() === "SUPER_ADMIN" ||
    String(role || "").toUpperCase() === "PLATFORM_ADMIN"
  );
}

/**
 * Synchronous role/flag gate before optional async enrollment check.
 * @returns {{
 *   decision: 'allow'|'deny'|'needs_enrollment'|'controlled_unavailable',
 *   code: string,
 * }}
 */
export function evaluateSkillAssessmentV5SyncAccess({
  user,
  flagEnabled = isPickVnRatingV5Enabled(),
} = {}) {
  if (!user?.id) {
    return { decision: "deny", code: "UNAUTHENTICATED" };
  }

  if (isSkillAssessmentV5AdminRole(user.role)) {
    return { decision: "allow", code: "ADMIN_TECH_EVAL" };
  }

  if (normalizeRole(user.role) !== ROLES.PLAYER) {
    return { decision: "deny", code: "FORBIDDEN_ROLE" };
  }

  if (!flagEnabled) {
    // Owner: 403 or existing controlled unavailable — preserve page-level unavailable UX.
    return { decision: "controlled_unavailable", code: "FEATURE_DISABLED" };
  }

  return { decision: "needs_enrollment", code: "NEEDS_ENROLLMENT_CHECK" };
}

/**
 * Page-level tech-eval (BR-B03-01) — must not re-block admins after the route guard allows.
 * Admins are allowed even when the V5 feature flag is OFF.
 * @returns {{
 *   allowed: boolean|null,
 *   code: string,
 * }}
 * `allowed: null` means PLAYER + flag ON → continue with enrollment async check.
 */
export function evaluateSkillAssessmentV5PageAccess({
  user,
  flagEnabled = isPickVnRatingV5Enabled(),
} = {}) {
  if (!user?.id) {
    return { allowed: false, code: "UNAUTHORIZED" };
  }

  if (isSkillAssessmentV5AdminRole(user.role)) {
    return { allowed: true, code: "ADMIN_TECH_EVAL" };
  }

  if (normalizeRole(user.role) !== ROLES.PLAYER) {
    return { allowed: false, code: "FORBIDDEN_ROLE" };
  }

  if (!flagEnabled) {
    return { allowed: false, code: "FEATURE_DISABLED" };
  }

  return { allowed: null, code: "NEEDS_ENROLLMENT_CHECK" };
}

/**
 * Full access evaluation including existing enrollment authority for PLAYER.
 */
export async function evaluateSkillAssessmentV5RouteAccess({
  user,
  flagEnabled = isPickVnRatingV5Enabled(),
} = {}) {
  const sync = evaluateSkillAssessmentV5SyncAccess({ user, flagEnabled });
  if (sync.decision === "allow") {
    return { ok: true, ...sync };
  }
  if (sync.decision === "deny") {
    return { ok: false, ...sync };
  }
  if (sync.decision === "controlled_unavailable") {
    return { ok: true, passToPage: true, ...sync };
  }

  const access = await resolveRatingV5Access();
  if (access.ok) {
    return {
      ok: true,
      decision: "allow",
      code: "PLAYER_ENROLLED",
      access,
    };
  }

  return {
    ok: false,
    decision: "deny",
    code: access.code || "PILOT_NOT_ENROLLED",
    access,
  };
}

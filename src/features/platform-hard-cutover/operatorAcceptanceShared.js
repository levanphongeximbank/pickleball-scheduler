import {
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
  extractSupabaseProjectRef,
} from "../communication/activation/stagingTarget.js";

export const OPERATOR_ACCEPTANCE_ROUTE =
  "/internal/hard-cutover/operator-acceptance";

export const OPERATOR_ACCEPTANCE_PROJECT_REF =
  COMMS_STAGING_PROJECT_REF;

export const OPERATOR_ACCEPTANCE_STEPS = Object.freeze([
  "A-OWN",
  "A-CLUB",
  "A-COURT",
  "A-PLAYER",
  "A-RATE",
  "A-COMP",
  "A-PAIR",
  "A-COACH",
  "A-MSG",
  "A-DASH",
  "A-CAT",
  "A-G1",
  "A-G2",
  "A-G3",
  "A-G4",
  "A-G5",
  "A-G6",
]);

export const OPERATOR_ACCEPTANCE_ERROR = Object.freeze({
  NOT_STAGING: "NOT_STAGING",
  PROJECT_REF_MISMATCH: "PROJECT_REF_MISMATCH",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  ROLE_FORBIDDEN: "ROLE_FORBIDDEN",
  TENANT_MISSING: "TENANT_MISSING",
  CLIENT_UNAVAILABLE: "CLIENT_UNAVAILABLE",
  SESSION_UNAVAILABLE: "SESSION_UNAVAILABLE",
  CLUB_CREATE_FAILED: "CLUB_CREATE_FAILED",
  COURT_CLUSTER_FAILED: "COURT_CLUSTER_FAILED",
  PLAYER_RESOLVE_FAILED: "PLAYER_RESOLVE_FAILED",
  RATING_FAILED: "RATING_FAILED",
  COMPETITION_FINALIZE_FAILED: "COMPETITION_FINALIZE_FAILED",
  PAIRING_FAILED: "PAIRING_FAILED",
  COACHING_FAILED: "COACHING_FAILED",
  MESSAGING_FAILED: "MESSAGING_FAILED",
  DASHBOARD_FAILED: "DASHBOARD_FAILED",
  CATALOG_FAILED: "CATALOG_FAILED",
});

function envBag(env) {
  if (env && typeof env === "object") return env;
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env;
  }
  return {};
}

function exactTrue(value) {
  return String(value ?? "").trim().toLowerCase() === "true";
}

export function maskOperatorIdentifier(value) {
  const raw = String(value || "").trim();
  if (!raw) return "unknown";
  if (raw.length <= 8) return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
  return `${raw.slice(0, 4)}***${raw.slice(-4)}`;
}

export function resolveOperatorAcceptanceTarget(env) {
  const bag = envBag(env);
  const appEnv = String(bag.VITE_APP_ENV || "").trim().toLowerCase();
  const supabaseUrl = String(bag.VITE_SUPABASE_URL || "").trim();
  const projectRef = extractSupabaseProjectRef(supabaseUrl);
  return Object.freeze({
    appEnv,
    projectRef,
    isStagingEnv: appEnv === "staging" || appEnv === "stage",
    isProductionRef: projectRef === COMMS_PRODUCTION_PROJECT_REF,
    isExpectedStagingRef: projectRef === OPERATOR_ACCEPTANCE_PROJECT_REF,
    ownerGoGranted:
      exactTrue(bag.VITE_HARD_CUTOVER_OPERATOR_ACCEPTANCE_ENABLED) ||
      exactTrue(bag.VITE_COACHING_STAGING_OWNER_GO_GRANTED) ||
      exactTrue(bag.VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED),
  });
}

export function resolveOperatorAcceptanceAccess({
  env,
  authUser,
  sessionUserId,
  currentTenantId,
  isSuperAdmin,
} = {}) {
  const target = resolveOperatorAcceptanceTarget(env);
  if (!target.isStagingEnv) {
    return { ok: false, code: OPERATOR_ACCEPTANCE_ERROR.NOT_STAGING, target };
  }
  if (!target.isExpectedStagingRef || target.isProductionRef) {
    return {
      ok: false,
      code: OPERATOR_ACCEPTANCE_ERROR.PROJECT_REF_MISMATCH,
      target,
    };
  }
  const actorId = String(sessionUserId || authUser?.id || "").trim();
  if (!actorId) {
    return {
      ok: false,
      code: OPERATOR_ACCEPTANCE_ERROR.UNAUTHENTICATED,
      target,
    };
  }
  const role = String(authUser?.role || "").trim().toUpperCase();
  const ownerLike =
    isSuperAdmin ||
    role === "SUPER_ADMIN" ||
    role === "PLATFORM_ADMIN" ||
    role === "VENUE_OWNER" ||
    role === "TENANT_OWNER";
  if (!ownerLike) {
    return { ok: false, code: OPERATOR_ACCEPTANCE_ERROR.ROLE_FORBIDDEN, target };
  }
  const tenantId = String(currentTenantId || authUser?.tenantId || authUser?.venueId || "").trim();
  if (!tenantId) {
    return { ok: false, code: OPERATOR_ACCEPTANCE_ERROR.TENANT_MISSING, target };
  }
  return {
    ok: true,
    target,
    actorId,
    maskedActorId: maskOperatorIdentifier(actorId),
    role,
    tenantId,
    isSuperAdmin: Boolean(isSuperAdmin),
  };
}

export function buildOperatorAcceptanceEvidence({
  access,
  steps = [],
  startedAt,
  finishedAt,
} = {}) {
  const sanitize = (value) => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/(token|jwt|password|secret)/i.test(String(key)))
        .map(([key, entry]) => [key, sanitize(entry)])
    );
  };
  return Object.freeze({
    marker: "PLATFORM_HARD_CUTOVER_01_OPERATOR_ACCEPTANCE_BROWSER_RUN",
    generatedAt: finishedAt || new Date().toISOString(),
    startedAt: startedAt || null,
    target: {
      projectRef: access?.target?.projectRef || null,
      environment: access?.target?.appEnv || null,
      tenantId: access?.tenantId || null,
    },
    actor: {
      maskedUserId: access?.maskedActorId || "unknown",
      role: access?.role || null,
      isSuperAdmin: Boolean(access?.isSuperAdmin),
    },
    steps: (steps || []).map((step) => ({
      id: step.id,
      status: step.status,
      code: step.code || null,
      message: step.message || null,
      objectId: step.objectId || null,
      observedAt: step.observedAt || null,
      details: sanitize(step.details || null),
    })),
    secretsPrinted: false,
  });
}

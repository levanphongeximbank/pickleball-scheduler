import { REFEREE_V5_ERROR, createPersistenceError } from "../persistence/errors.js";
import {
  ADAPTER_B_CONTRACT_ID,
  MATCH_EXECUTION_INIT_ALLOWED_ACTOR_ROLES,
  MATCH_EXECUTION_INIT_MODES,
} from "./matchExecutionInitPolicy.js";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isBrowserRuntime() {
  return typeof globalThis.window !== "undefined";
}

/**
 * Initialization is a trusted-server / organizer operation.
 * Assigned REFEREE cannot initialize arbitrary matches.
 * Venue is never a tenant fallback.
 */
export function authorizeMatchExecutionInit(input = {}) {
  if (isBrowserRuntime()) {
    return createPersistenceError(
      REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN,
      "Khởi tạo trạng thái thi đấu chỉ chạy trên trusted server."
    );
  }

  if (input.initialState != null || input.statePayload != null || input.stateSnapshot != null) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Không chấp nhận snapshot trình duyệt làm authority."
    );
  }

  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || input.competitionId || "").trim();
  const matchId = String(input.matchId || "").trim();
  const competitionMode = String(input.competitionMode || "").trim().toUpperCase();
  const idempotencyKey = String(input.idempotencyKey || "").trim();

  if (!tenantId || !tournamentId || !matchId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "tenantId, tournamentId và matchId là bắt buộc."
    );
  }
  if (!MATCH_EXECUTION_INIT_MODES.includes(competitionMode)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      `competitionMode không hợp lệ: ${competitionMode || "(empty)"}`
    );
  }
  if (!idempotencyKey) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "idempotencyKey là bắt buộc."
    );
  }

  const actor = input.actor || input.trustedActor || null;
  const actorId = String(actor?.actorId || actor?.userId || actor?.authUid || "").trim();
  const actorTenantId = String(actor?.tenantId || "").trim();
  const actorRole = String(actor?.role || "").trim().toUpperCase();

  if (!actorId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "Trusted actor/system context is required."
    );
  }
  if (actorTenantId && actorTenantId !== tenantId) {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  if (actor?.venueId && !actorTenantId && String(actor.venueId) === tenantId) {
    return createPersistenceError(
      REFEREE_V5_ERROR.TENANT_ACCESS_DENIED,
      "Venue không được dùng làm tenant fallback."
    );
  }
  if (!MATCH_EXECUTION_INIT_ALLOWED_ACTOR_ROLES.includes(actorRole)) {
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      "REFEREE không được khởi tạo trạng thái thi đấu tùy ý."
    );
  }

  const adapter = input.adapter;
  if (!adapter || typeof adapter !== "object") {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Canonical Adapter B match context is required."
    );
  }
  if (String(adapter.contractId || "") !== ADAPTER_B_CONTRACT_ID) {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Adapter B contractId không khớp."
    );
  }
  const required = [
    "getCompetitionContext",
    "getMatchContext",
    "getParticipants",
    "getScoringRules",
    "validatePreStart",
  ];
  for (const method of required) {
    if (typeof adapter[method] !== "function") {
      return createPersistenceError(
        REFEREE_V5_ERROR.NOT_CONFIGURED,
        `Adapter B thiếu method ${method}.`
      );
    }
  }

  return {
    ok: true,
    tenantId,
    tournamentId,
    matchId,
    competitionMode,
    idempotencyKey,
    actorId,
    actorRole,
    adapter,
  };
}

export function mapAdapterBFailure(err) {
  const code = String(err?.code || "");
  if (code === "REFEREE_ADAPTER_UNKNOWN_MATCH") {
    return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
  }
  if (code === "REFEREE_ADAPTER_CROSS_TENANT_CONTEXT") {
    return createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  }
  if (code === "REFEREE_ADAPTER_MISSING_SCORING_RULES") {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      err instanceof Error ? err.message : "Missing scoring rules"
    );
  }
  if (code === "REFEREE_ADAPTER_MALFORMED_CONTEXT") {
    const message = err instanceof Error ? err.message : "";
    if (/unknown competition/i.test(message) || /competitionId/i.test(message)) {
      return createPersistenceError(
        REFEREE_V5_ERROR.MATCH_STATE_CONFLICT,
        "Tournament binding không khớp canonical match."
      );
    }
    return createPersistenceError(
      REFEREE_V5_ERROR.VALIDATION_DENIED,
      message || "Adapter B context không hợp lệ."
    );
  }
  return createPersistenceError(
    REFEREE_V5_ERROR.VALIDATION_DENIED,
    err instanceof Error ? err.message : "Adapter B context bị từ chối."
  );
}

export function isNonEmptyText(value) {
  return isNonEmptyString(value);
}

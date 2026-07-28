/**
 * Competition Remote SSOT — ports and fail-closed / remote adapters (M8).
 * Tenant IDs are text venue ids (public.venues.id / user_venue_id()), not UUID.
 */

import {
  isCompetitionRemoteSsotEnabled,
  isPlatformHardCutoverEnabled,
} from "../../platform-hard-cutover/runtimeAuthorityMatrix.js";

export const COMPETITION_SSOT_ERROR = Object.freeze({
  UNAVAILABLE: "COMPETITION_SSOT_UNAVAILABLE",
  INVALID_ARGS: "COMPETITION_SSOT_INVALID_ARGS",
  FORBIDDEN: "COMPETITION_SSOT_FORBIDDEN",
  RPC_FAILED: "COMPETITION_SSOT_RPC_FAILED",
});

export const COMPETITION_SSOT_RPC = Object.freeze({
  APPEND_COMMAND: "competition_ssot_append_command",
  UPSERT_WORKING_SCORE: "competition_ssot_upsert_working_score",
  FINALIZE: "competition_ssot_finalize_match_result",
});

/**
 * Normalize / validate text tenant id (venue id). Fail-closed on blank/missing.
 * @param {unknown} value
 * @returns {{ ok: true, tenantId: string } | { ok: false, code: string, error: string }}
 */
export function assertTextTenantId(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return {
      ok: false,
      code: COMPETITION_SSOT_ERROR.INVALID_ARGS,
      error: "tenantId must be a non-empty text venue id",
    };
  }
  return { ok: true, tenantId: value.trim() };
}

export function createFailClosedCompetitionSsotAdapter(
  reason = "Remote Competition SSOT not available"
) {
  async function blocked() {
    return {
      ok: false,
      code: COMPETITION_SSOT_ERROR.UNAVAILABLE,
      error: reason,
    };
  }
  return {
    kind: "fail_closed",
    finalizeMatchResult: blocked,
    appendCommand: blocked,
    upsertWorkingScore: blocked,
  };
}

/**
 * @param {{ rpc: (name: string, args: Record<string, unknown>) => Promise<{ data?: unknown, error?: { message?: string } }> }} deps
 */
export function createRemoteCompetitionSsotAdapter(deps) {
  if (!deps || typeof deps.rpc !== "function") {
    return createFailClosedCompetitionSsotAdapter("Competition SSOT RPC client missing");
  }

  async function call(name, args) {
    const { data, error } = await deps.rpc(name, args);
    if (error) {
      return {
        ok: false,
        code: COMPETITION_SSOT_ERROR.RPC_FAILED,
        error: String(error.message || error),
      };
    }
    const payload = data && typeof data === "object" ? data : { ok: true, data };
    return { ok: true, ...payload };
  }

  return {
    kind: "remote_ssot",
    async finalizeMatchResult(input) {
      const tenant = assertTextTenantId(input?.tenantId);
      if (!tenant.ok) return tenant;
      if (!input?.matchId || !input?.idempotencyKey) {
        return {
          ok: false,
          code: COMPETITION_SSOT_ERROR.INVALID_ARGS,
          error: "tenantId, matchId, idempotencyKey required",
        };
      }
      return call(COMPETITION_SSOT_RPC.FINALIZE, {
        p_tenant_id: tenant.tenantId,
        p_match_id: input.matchId,
        p_result_payload: input.resultPayload || {},
        p_idempotency_key: input.idempotencyKey,
        p_winner_side: input.winnerSide ?? null,
        p_source: input.source || "competition_ssot_finalize",
      });
    },
    async appendCommand(input) {
      const tenant = assertTextTenantId(input?.tenantId);
      if (!tenant.ok) return tenant;
      return call(COMPETITION_SSOT_RPC.APPEND_COMMAND, {
        p_tenant_id: tenant.tenantId,
        p_competition_id: input.competitionId,
        p_command_type: input.commandType,
        p_command_payload: input.commandPayload || {},
        p_idempotency_key: input.idempotencyKey,
      });
    },
    async upsertWorkingScore(input) {
      const tenant = assertTextTenantId(input?.tenantId);
      if (!tenant.ok) return tenant;
      return call(COMPETITION_SSOT_RPC.UPSERT_WORKING_SCORE, {
        p_tenant_id: tenant.tenantId,
        p_match_id: input.matchId,
        p_working_score: input.workingScore || {},
        p_idempotency_key: input.idempotencyKey,
      });
    },
  };
}

/**
 * Resolve Production competition persistence authority.
 * In-memory allowed only via allowInMemoryForTests (unit tests).
 */
export function resolveCompetitionSsotAdapter({
  env,
  rpc,
  allowInMemoryForTests = false,
} = {}) {
  const remoteEnabled = isCompetitionRemoteSsotEnabled(env);

  if (remoteEnabled) {
    if (!rpc) {
      return createFailClosedCompetitionSsotAdapter(
        "VITE_COMPETITION_REMOTE_SSOT_ENABLED but RPC client missing"
      );
    }
    return createRemoteCompetitionSsotAdapter({ rpc });
  }

  if (allowInMemoryForTests) {
    return {
      kind: "test_memory",
      async finalizeMatchResult() {
        return { ok: true, replay: false, testMemory: true };
      },
      async appendCommand() {
        return { ok: true, testMemory: true };
      },
      async upsertWorkingScore() {
        return { ok: true, testMemory: true };
      },
    };
  }

  if (isPlatformHardCutoverEnabled(env)) {
    return createFailClosedCompetitionSsotAdapter(
      "Hard cutover requires VITE_COMPETITION_REMOTE_SSOT_ENABLED"
    );
  }

  return createFailClosedCompetitionSsotAdapter(
    "Competition remote SSOT disabled — enable flag after SQL apply"
  );
}

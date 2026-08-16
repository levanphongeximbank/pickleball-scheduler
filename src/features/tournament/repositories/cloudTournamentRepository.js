/**
 * Cloud Tournament repository — sole canonical organizer authority.
 * All operations are async RPC-backed. No blob/localStorage/mock fallback.
 * Tenant must be supplied explicitly from canonical runtime club projection.
 */
import {
  TOURNAMENT_REPO_ERROR,
  TOURNAMENT_REPOSITORY_KINDS,
} from "./TournamentRepository.interface.js";
import { resolveTournamentTenantScope } from "../guards/tournamentTenant.js";
import { CANONICAL_TOURNAMENT_RPC } from "./canonicalTournamentRpcs.js";
import {
  canonicalRowToTournament,
  tournamentToCanonicalRow,
} from "../mappers/canonicalTournamentMapper.js";
import { createTournamentRecord, TOURNAMENT_MODE } from "../../../models/tournament/index.js";
import {
  validateInternalTournamentStatusTransition,
} from "../internal/internalTournamentStatusTransitions.js";
import {
  assertInternalStatusCompletionGate,
} from "../internal/internalTournamentCompletionEligibility.js";
import {
  CANONICAL_TOURNAMENT_VERSION_CONFLICT,
  CANONICAL_TOURNAMENT_VERSION_REQUIRED,
  assertInternalExpectedVersion,
  resolveCanonicalExpectedVersion,
} from "../internal/canonicalTournamentCas.js";

export { CANONICAL_TOURNAMENT_RPC };

function normalizeRpcPayload(data) {
  if (data && typeof data === "object" && "ok" in data) return data;
  return { ok: true, data };
}

function classifyCanonicalRpcFailure(error) {
  const message = String(error?.message || error || "");
  if (/expected_version is required/i.test(message) || /VERSION_REQUIRED/i.test(message)) {
    return {
      ok: false,
      code: TOURNAMENT_REPO_ERROR.VERSION_REQUIRED,
      error: message,
    };
  }
  if (/VERSION_CONFLICT/i.test(message)) {
    return {
      ok: false,
      code: TOURNAMENT_REPO_ERROR.VERSION_CONFLICT,
      error: message,
    };
  }
  return undefined;
}

function tenantOpts(options = {}) {
  return { tenantId: options.tenantId };
}

/**
 * @param {{ rpc?: (name: string, args: Record<string, unknown>) => Promise<unknown> }} [deps]
 */
export function createCloudTournamentRepository(deps = {}) {
  async function callRpc(name, args) {
    if (typeof deps.rpc === "function") {
      try {
        return normalizeRpcPayload(await deps.rpc(name, args));
      } catch (error) {
        return (
          classifyCanonicalRpcFailure(error) || {
            ok: false,
            code: TOURNAMENT_REPO_ERROR.CLOUD_UNAVAILABLE,
            error: String(error?.message || error),
          }
        );
      }
    }

    // Must use the Auth session client. `getSupabaseClient` is NOT exported from
    // supabaseClient.js — importing it threw TypeError and silently broke create.
    try {
      const { hasSupabaseConfig, getSupabaseAuthClient } = await import(
        "../../../auth/supabaseClient.js"
      );
      if (!hasSupabaseConfig()) {
        return {
          ok: false,
          code: TOURNAMENT_REPO_ERROR.CLOUD_UNAVAILABLE,
          error: "Thiếu cấu hình Supabase cho Tournament cloud.",
        };
      }
      const client = getSupabaseAuthClient();
      if (!client?.rpc) {
        return {
          ok: false,
          code: TOURNAMENT_REPO_ERROR.CLOUD_UNAVAILABLE,
          error: "Supabase client không khả dụng.",
        };
      }
      const { data, error } = await client.rpc(name, args);
      if (error) {
        return (
          classifyCanonicalRpcFailure(error) || {
            ok: false,
            code: TOURNAMENT_REPO_ERROR.CLOUD_UNAVAILABLE,
            error: String(error.message || error),
          }
        );
      }
      return normalizeRpcPayload(data);
    } catch (error) {
      return (
        classifyCanonicalRpcFailure(error) || {
          ok: false,
          code: TOURNAMENT_REPO_ERROR.CLOUD_UNAVAILABLE,
          error: String(error?.message || error),
        }
      );
    }
  }

  return {
    kind: TOURNAMENT_REPOSITORY_KINDS.CLOUD,

    async list(clubIdOrScope, filters = {}, options = {}) {
      const tenantCheck = resolveTournamentTenantScope(clubIdOrScope, tenantOpts(options));
      if (!tenantCheck.ok) {
        return { ok: false, ...tenantCheck, tournaments: [] };
      }
      const result = await callRpc(CANONICAL_TOURNAMENT_RPC.LIST, {
        p_tenant_id: tenantCheck.tenantId,
        p_club_id: tenantCheck.clubId,
        p_filters: filters || {},
      });
      if (!result.ok) return { ...result, tournaments: [] };
      const rows = Array.isArray(result.tournaments)
        ? result.tournaments
        : Array.isArray(result.data)
          ? result.data
          : [];
      return {
        ok: true,
        tournaments: rows.map(canonicalRowToTournament).filter(Boolean),
      };
    },

    async get(clubIdOrScope, tournamentId, options = {}) {
      const tenantCheck = resolveTournamentTenantScope(clubIdOrScope, tenantOpts(options));
      if (!tenantCheck.ok) return { ok: false, ...tenantCheck, tournament: null };
      const result = await callRpc(CANONICAL_TOURNAMENT_RPC.GET, {
        p_tenant_id: tenantCheck.tenantId,
        p_club_id: tenantCheck.clubId,
        p_tournament_id: tournamentId,
      });
      if (!result.ok) return { ...result, tournament: null };
      const row = result.tournament || result.data || null;
      return { ok: true, tournament: canonicalRowToTournament(row) };
    },

    async listMine(clubIdOrScope, filters = {}, options = {}) {
      const tenantCheck = resolveTournamentTenantScope(clubIdOrScope, tenantOpts(options));
      if (!tenantCheck.ok) {
        return { ok: false, ...tenantCheck, tournaments: [] };
      }
      const playerId = String(filters.playerId || "").trim();
      if (!playerId) {
        return {
          ok: false,
          code: TOURNAMENT_REPO_ERROR.FORBIDDEN,
          error: "Thiếu playerId cho listMine.",
          tournaments: [],
        };
      }
      const result = await callRpc(CANONICAL_TOURNAMENT_RPC.LIST_MINE, {
        p_tenant_id: tenantCheck.tenantId,
        p_club_id: tenantCheck.clubId,
        p_player_id: playerId,
      });
      if (!result.ok) return { ...result, tournaments: [] };
      const rows = Array.isArray(result.tournaments)
        ? result.tournaments
        : Array.isArray(result.data)
          ? result.data
          : [];
      return {
        ok: true,
        tournaments: rows.map(canonicalRowToTournament).filter(Boolean),
      };
    },

    async create(clubIdOrScope, options = {}) {
      const tenantCheck = resolveTournamentTenantScope(clubIdOrScope, tenantOpts(options));
      if (!tenantCheck.ok) return tenantCheck;

      const record = createTournamentRecord(tenantCheck.clubId, {
        ...options,
        tenantId: tenantCheck.tenantId,
      });
      const row = tournamentToCanonicalRow(record, {
        tenantId: tenantCheck.tenantId,
        clubId: tenantCheck.clubId,
      });

      const result = await callRpc(CANONICAL_TOURNAMENT_RPC.CREATE, {
        p_tenant_id: tenantCheck.tenantId,
        p_club_id: tenantCheck.clubId,
        p_payload: {
          external_key: row.external_key || record.id,
          name: row.name,
          mode: row.mode,
          status: row.status,
          season_id: row.season_id,
          league_id: row.league_id,
          payload: {
            ...row.payload,
            id: record.id,
            createdBy: options.createdBy || options.ownerPlayerId || null,
            ownerPlayerId: options.ownerPlayerId || options.createdBy || null,
          },
          engine_v4: row.engine_v4,
        },
      });
      if (!result.ok) return result;
      return {
        ok: true,
        tournament: canonicalRowToTournament(result.tournament || result.data),
      };
    },

    async update(clubIdOrScope, tournamentId, patch = {}, options = {}) {
      const tenantCheck = resolveTournamentTenantScope(clubIdOrScope, tenantOpts(options));
      if (!tenantCheck.ok) return tenantCheck;

      const current = await this.get(clubIdOrScope, tournamentId, options);
      if (!current.ok || !current.tournament) {
        return {
          ok: false,
          code: TOURNAMENT_REPO_ERROR.NOT_FOUND,
          error: current.error || "Không tìm thấy giải.",
        };
      }

      const isInternal =
        current.tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT;
      const nextStatus =
        patch.status != null ? patch.status : current.tournament.status;
      if (
        isInternal &&
        nextStatus != null &&
        String(nextStatus) !== String(current.tournament.status || "")
      ) {
        const transition = validateInternalTournamentStatusTransition(
          current.tournament.status,
          nextStatus,
          { forceReopen: options.forceStatusReopen === true }
        );
        if (!transition.ok) {
          return {
            ok: false,
            code: TOURNAMENT_REPO_ERROR.INTERNAL_STATUS_TRANSITION_DENIED,
            error: transition.error,
            from: transition.from,
            to: transition.to,
            tournament: current.tournament,
          };
        }
      }

      const merged = {
        ...current.tournament,
        ...patch,
        id: tournamentId,
        clubId: tenantCheck.clubId,
        tenantId: tenantCheck.tenantId,
        settings: {
          ...(current.tournament.settings || {}),
          ...(patch.settings || {}),
        },
        updatedAt: new Date().toISOString(),
      };
      if (patch.settings?.engineV4) {
        merged.settings.engineV4 = patch.settings.engineV4;
      }

      if (isInternal) {
        const completionGate = assertInternalStatusCompletionGate(
          current.tournament,
          nextStatus,
          merged
        );
        if (!completionGate.ok) {
          return {
            ok: false,
            code: TOURNAMENT_REPO_ERROR.INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
            error: completionGate.error,
            reason: completionGate.reason,
            tournament: current.tournament,
          };
        }
      }

      const row = tournamentToCanonicalRow(merged, {
        tenantId: tenantCheck.tenantId,
        clubId: tenantCheck.clubId,
      });

      // Internal: CAS mandatory. requireCas:false is rejected (cannot bypass).
      // Team/other modes: omit expected_version remains backward compatible.
      if (isInternal && options.requireCas === false) {
        return {
          ok: false,
          code: TOURNAMENT_REPO_ERROR.VERSION_REQUIRED,
          error:
            "requireCas:false không được phép với internal_tournament. Hệ thống đã từ chối ghi.",
          tournament: current.tournament,
        };
      }

      let expectedVersion = resolveCanonicalExpectedVersion(
        options.expectedVersion != null
          ? options.expectedVersion
          : current.tournament
      );
      if (isInternal) {
        const casGate = assertInternalExpectedVersion(expectedVersion, {
          mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
        });
        if (!casGate.ok) {
          return {
            ok: false,
            code: TOURNAMENT_REPO_ERROR.VERSION_REQUIRED,
            error: casGate.error,
            tournament: current.tournament,
          };
        }
        expectedVersion = casGate.expectedVersion;
      } else if (options.requireCas === false) {
        expectedVersion = null;
      }

      const result = await callRpc(CANONICAL_TOURNAMENT_RPC.UPDATE, {
        p_tenant_id: tenantCheck.tenantId,
        p_club_id: tenantCheck.clubId,
        p_tournament_id: tournamentId,
        p_patch: {
          name: row.name,
          status: row.status,
          season_id: row.season_id,
          league_id: row.league_id,
          payload: row.payload,
          engine_v4: row.engine_v4,
          ...(expectedVersion != null ? { expected_version: expectedVersion } : {}),
          ...(options.forceStatusReopen ? { force_status_reopen: true } : {}),
          ...(options.engineApply ? { engine_apply: true } : {}),
        },
      });
      if (!result.ok) {
        const code = String(result.code || "").toUpperCase();
        if (code === CANONICAL_TOURNAMENT_VERSION_CONFLICT || code === "VERSION_CONFLICT") {
          return {
            ...result,
            ok: false,
            code: TOURNAMENT_REPO_ERROR.VERSION_CONFLICT,
            tournament: current.tournament,
          };
        }
        if (code === CANONICAL_TOURNAMENT_VERSION_REQUIRED || code === "VERSION_REQUIRED") {
          return {
            ...result,
            ok: false,
            code: TOURNAMENT_REPO_ERROR.VERSION_REQUIRED,
            tournament: current.tournament,
          };
        }
        if (
          code === TOURNAMENT_REPO_ERROR.INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE ||
          code === "INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE"
        ) {
          return {
            ...result,
            ok: false,
            code: TOURNAMENT_REPO_ERROR.INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE,
            tournament: current.tournament,
          };
        }
        return result;
      }
      return {
        ok: true,
        tournament: canonicalRowToTournament(result.tournament || result.data),
      };
    },

    async delete(clubIdOrScope, tournamentId, options = {}) {
      const tenantCheck = resolveTournamentTenantScope(clubIdOrScope, tenantOpts(options));
      if (!tenantCheck.ok) return tenantCheck;
      const result = await callRpc(CANONICAL_TOURNAMENT_RPC.DELETE, {
        p_tenant_id: tenantCheck.tenantId,
        p_club_id: tenantCheck.clubId,
        p_tournament_id: tournamentId,
      });
      return result.ok ? { ok: true } : result;
    },

    async applyEngineState(clubIdOrScope, tournamentId, engineState = {}, options = {}) {
      const tenantCheck = resolveTournamentTenantScope(clubIdOrScope, tenantOpts(options));
      if (!tenantCheck.ok) return tenantCheck;

      const result = await callRpc(CANONICAL_TOURNAMENT_RPC.APPLY_ENGINE, {
        p_tenant_id: tenantCheck.tenantId,
        p_club_id: tenantCheck.clubId,
        p_tournament_id: tournamentId,
        p_engine_state: engineState || {},
      });
      if (!result.ok) return result;

      if (Array.isArray(engineState.events)) {
        return this.update(
          clubIdOrScope,
          tournamentId,
          { events: engineState.events, settings: { engineV4: engineState } },
          { ...options, engineApply: true }
        );
      }

      return {
        ok: true,
        tournament: canonicalRowToTournament(result.tournament || result.data),
      };
    },
  };
}

import { getTeamTournamentRealtimeService } from "../realtime/TeamTournamentRealtimeService.js";
import { rpcTeamTournamentGetSetup } from "../services/teamTournamentRpcService.js";
import {
  repositoryFailure,
  repositorySuccess,
} from "./TeamTournamentRepository.interface.js";
import {
  REPOSITORY_ERROR_CODES,
  REPOSITORY_REALTIME_FALLBACK,
} from "./teamTournamentRepositoryTypes.js";

/**
 * Resolve tenant id from get-setup payload.
 * @param {object} setupResult
 * @param {string} [clubId]
 */
export function resolveTenantIdFromSetup(setupResult, clubId) {
  return (
    setupResult?.tenantId ??
    setupResult?.tenant_id ??
    setupResult?.tournament?.tenantId ??
    setupResult?.tournament?.tenant_id ??
    setupResult?.tournament?.meta?.tenantId ??
    clubId ??
    null
  );
}

/**
 * Cloud repository realtime delegate.
 * @param {object} repo
 * @param {string} clubId
 * @param {string} tournamentId
 * @param {import('./teamTournamentRepositoryTypes.js').TournamentSubscriptionHandlers} handlers
 */
export async function subscribeCloudTournament(repo, clubId, tournamentId, handlers = {}) {
  const setup = await rpcTeamTournamentGetSetup(tournamentId, null);
  if (!setup.ok) {
    return repositoryFailure(
      setup.code || REPOSITORY_ERROR_CODES.NOT_FOUND,
      setup.error || "Không tải được giải để subscribe.",
      { provider: "cloud" }
    );
  }

  const tenantId = resolveTenantIdFromSetup(setup, clubId);
  if (!tenantId) {
    return repositoryFailure(
      REPOSITORY_ERROR_CODES.INVALID_COMMAND_OPTIONS,
      "Thiếu tenantId cho realtime subscription.",
      { provider: "cloud" }
    );
  }

  const service = getTeamTournamentRealtimeService();
  const refreshSnapshot = async ({ reason } = {}) => {
    const result = await repo.getTournament(clubId, tournamentId, { silent: true });
    if (result.ok && handlers.onTournamentChange) {
      handlers.onTournamentChange({
        type: "snapshot.reload",
        tournamentId,
        payload: { reason, version: result.version },
      });
    }
    return { ok: result.ok, version: result.version ?? 0, result };
  };

  const { subscriptionId, mode } = service.subscribeTournament({
    tenantId: String(tenantId),
    tournamentId: String(tournamentId),
    clubId,
    handlers,
    refreshSnapshot,
    onConnectionStateChange: (state) => {
      handlers.onConnectionStateChange?.(state);
      if (state === "unauthorized") {
        handlers.onError?.({
          code: "realtime_unauthorized",
          error: "Không có quyền truy cập đồng bộ realtime.",
        });
      }
    },
  });

  const fallbackMode = mode === "realtime" || mode === "referee_v5_adapter" ? "realtime" : "polling";

  return repositorySuccess(
    {
      subscriptionId,
      unsubscribe: () => service.unsubscribe(subscriptionId),
      fallbackMode,
      pollingIntervalMs: REPOSITORY_REALTIME_FALLBACK.pollingIntervalMs,
      mode,
    },
    { provider: "cloud" }
  );
}

/**
 * Blob repository — polling-only subscription contract (no Supabase channel).
 */
export async function subscribeBlobTournamentPollingOnly(repo, clubId, tournamentId, handlers = {}) {
  const service = getTeamTournamentRealtimeService();
  const setup = await repo.getTournament(clubId, tournamentId);
  if (!setup.ok) {
    return setup;
  }

  const tenantId = clubId || tournamentId;
  const refreshSnapshot = async () => {
    const result = await repo.getTournament(clubId, tournamentId);
    if (result.ok && handlers.onTournamentChange) {
      handlers.onTournamentChange({
        type: "snapshot.polled",
        tournamentId,
        payload: { version: result.version },
      });
    }
    return { ok: result.ok, version: result.version ?? 0 };
  };

  const { subscriptionId } = service.subscribeTournament({
    tenantId: String(tenantId),
    tournamentId: String(tournamentId),
    clubId,
    handlers,
    refreshSnapshot,
    pollingOnly: true,
  });

  return repositorySuccess(
    {
      subscriptionId,
      unsubscribe: () => service.unsubscribe(subscriptionId),
      fallbackMode: "polling",
      pollingIntervalMs: REPOSITORY_REALTIME_FALLBACK.pollingIntervalMs,
      mode: "polling_only",
    },
    { provider: "blob" }
  );
}

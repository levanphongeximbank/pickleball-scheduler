/**
 * Cloud-authoritative Dreambreaker command wrappers.
 * No blob/localStorage writes — callers reload via get_setup.
 */

import {
  rpcTeamTournamentSubmitDreambreakerOrder,
  rpcTeamTournamentLockDreambreakerOrder,
  rpcTeamTournamentRecordDreambreakerPoint,
  rpcTeamTournamentSyncDreambreaker,
  rpcTeamTournamentStartDreambreaker,
  rpcTeamTournamentUndoDreambreakerPoint,
  rpcTeamTournamentDreambreakerInjury,
} from "./teamTournamentRpcService.js";

function buildIdempotencyKey(prefix, parts = []) {
  const suffix = parts.map((p) => String(p || "").trim()).filter(Boolean).join(":");
  return `${prefix}:${suffix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function mapRpc(result, extra = {}) {
  if (!result?.ok) {
    return {
      ok: false,
      usedCloud: true,
      error: result?.error || result?.code || "Dreambreaker cloud command failed.",
      code: result?.code,
      ...result,
    };
  }
  return {
    ok: true,
    usedCloud: true,
    ...result,
    ...extra,
    completed: Boolean(result.completed || result.winnerTeamId),
    winnerTeamId: result.winnerTeamId || "",
    changed: result.changed ?? result.activatedCount > 0,
  };
}

export async function cloudSubmitDreambreakerOrder(tournamentId, payload = {}, options = {}) {
  return mapRpc(
    await rpcTeamTournamentSubmitDreambreakerOrder({
      tournamentId,
      matchupId: payload.matchupId,
      teamId: payload.teamId,
      order: payload.order || [],
      expectedVersion: options.expectedVersion ?? payload.expectedVersion ?? null,
      idempotencyKey:
        options.idempotencyKey ||
        buildIdempotencyKey("db-order", [tournamentId, payload.matchupId, payload.teamId]),
    })
  );
}

export async function cloudLockDreambreakerOrder(tournamentId, payload = {}, options = {}) {
  return mapRpc(
    await rpcTeamTournamentLockDreambreakerOrder({
      tournamentId,
      matchupId: payload.matchupId,
      expectedVersion: options.expectedVersion ?? payload.expectedVersion ?? null,
      idempotencyKey:
        options.idempotencyKey ||
        buildIdempotencyKey("db-lock", [tournamentId, payload.matchupId]),
    })
  );
}

export async function cloudStartDreambreaker(tournamentId, payload = {}, options = {}) {
  return mapRpc(
    await rpcTeamTournamentStartDreambreaker({
      tournamentId,
      matchupId: payload.matchupId,
      expectedVersion: options.expectedVersion ?? payload.expectedVersion ?? null,
      idempotencyKey:
        options.idempotencyKey ||
        `db-start:${tournamentId}:${payload.matchupId}`,
    })
  );
}

export async function cloudRecordDreambreakerPoint(tournamentId, payload = {}, options = {}) {
  return mapRpc(
    await rpcTeamTournamentRecordDreambreakerPoint({
      tournamentId,
      matchupId: payload.matchupId,
      scoringTeamId: payload.scoringTeamId,
      expectedVersion: options.expectedVersion ?? payload.expectedVersion ?? null,
      idempotencyKey:
        options.idempotencyKey ||
        `db-point:${tournamentId}:${payload.matchupId}:${options.expectedVersion ?? payload.expectedVersion}:${payload.scoringTeamId}`,
    })
  );
}

export async function cloudUndoDreambreakerPoint(tournamentId, payload = {}, options = {}) {
  return mapRpc(
    await rpcTeamTournamentUndoDreambreakerPoint({
      tournamentId,
      matchupId: payload.matchupId,
      expectedVersion: options.expectedVersion ?? payload.expectedVersion ?? null,
      idempotencyKey:
        options.idempotencyKey ||
        `db-undo:${tournamentId}:${payload.matchupId}:${options.expectedVersion ?? payload.expectedVersion}`,
    })
  );
}

export async function cloudDreambreakerInjury(tournamentId, payload = {}, options = {}) {
  return mapRpc(
    await rpcTeamTournamentDreambreakerInjury({
      tournamentId,
      matchupId: payload.matchupId,
      teamId: payload.teamId,
      playerId: payload.playerId || payload.skippedPlayerId,
      expectedVersion: options.expectedVersion ?? payload.expectedVersion ?? null,
      idempotencyKey:
        options.idempotencyKey ||
        buildIdempotencyKey("db-injury", [tournamentId, payload.matchupId, payload.playerId]),
    })
  );
}

export async function cloudSyncDreambreaker(tournamentId, options = {}) {
  return mapRpc(
    await rpcTeamTournamentSyncDreambreaker({
      tournamentId,
      expectedVersion: options.expectedVersion ?? null,
      idempotencyKey:
        options.idempotencyKey || buildIdempotencyKey("db-sync", [tournamentId]),
    })
  );
}

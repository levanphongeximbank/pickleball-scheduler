import { VPR_AWARD_STATUS } from "../../../models/tournament/constants.js";
import { getTournament, updateTournament } from "../../../domain/tournamentService.js";
import { calculateVprPoints } from "../engines/vprCalculationEngine.js";
import { resolvePlacementsPerCategory } from "../engines/placementResolver.js";
import { canAwardVprPoints } from "../utils/vprEligibility.js";
import { resolveOrCreateVprAthlete } from "./vprAthleteService.js";
import { rebuildLeaderboardFromLedger } from "./vprLeaderboardService.js";
import { logVprAudit, VPR_AUDIT_ACTIONS } from "./vprAuditService.js";
import {
  appendLedgerEntries,
  listLedgerEntries,
  removeLedgerByTournament,
} from "../storage/vprLocalStore.js";
import { isVprCloudSyncEnabled } from "../config/vprFlags.js";
import { rpcVprAwardTournament, rpcVprRecalculateTournament } from "./vprRpcService.js";

function createBatchId() {
  return `vpr-batch-${Date.now()}`;
}

function buildLedgerEntry({
  batchId,
  tournament,
  category,
  placement,
  points,
  athlete,
  clubId,
}) {
  return {
    id: `vpr-ledger-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    batchId,
    clubId,
    tenantId: tournament.tenantId || null,
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    tournamentLevel: tournament.tournamentLevel,
    category,
    placement,
    points,
    vprAthleteId: athlete.id,
    displayName: athlete.displayName,
    clubName: athlete.clubName || tournament.hostClubName || "",
    region: athlete.region || "",
    gender: athlete.gender || "unknown",
    awardedAt: new Date().toISOString(),
  };
}

function awardLocally(clubId, tournament, actorUserId = null) {
  const eligibility = canAwardVprPoints(tournament);
  if (!eligibility.ok) {
    return { ok: false, reason: eligibility.reason };
  }

  const batchId = createBatchId();
  const categoryBlocks = resolvePlacementsPerCategory(tournament);
  const ledgerEntries = [];

  for (const block of categoryBlocks) {
    for (const row of block.placements) {
      const points = calculateVprPoints({
        tournamentLevel: tournament.tournamentLevel,
        placement: row.placement,
        participantCount: block.participantCount,
      });

      if (row.playerIds) {
        for (const playerId of row.playerIds) {
          const { athlete } = resolveOrCreateVprAthlete({
            clubId,
            playerId,
            tenantId: tournament.tenantId,
            displayName: row.teamName,
            region: "",
          });
          ledgerEntries.push(
            buildLedgerEntry({
              batchId,
              tournament,
              category: block.category,
              placement: row.placement,
              points,
              athlete,
              clubId,
            })
          );
        }
        continue;
      }

      const entry = row.entry;
      const playerIds = (entry?.playerIds || []).map(String).filter(Boolean);
      if (!playerIds.length) {
        continue;
      }
      for (const playerId of playerIds) {
        const { athlete } = resolveOrCreateVprAthlete({
          clubId,
          playerId,
          tenantId: tournament.tenantId,
        });
        ledgerEntries.push(
          buildLedgerEntry({
            batchId,
            tournament,
            category: block.category,
            placement: row.placement,
            points,
            athlete,
            clubId,
          })
        );
      }
    }
  }

  if (!ledgerEntries.length) {
    updateTournament(clubId, tournament.id, {
      vprAward: {
        status: VPR_AWARD_STATUS.SKIPPED,
        awardedAt: new Date().toISOString(),
        batchId: null,
      },
    });
    return { ok: true, skipped: true, reason: "no-placements" };
  }

  appendLedgerEntries(ledgerEntries);
  rebuildLeaderboardFromLedger();

  updateTournament(clubId, tournament.id, {
    vprAward: {
      status: VPR_AWARD_STATUS.AWARDED,
      awardedAt: new Date().toISOString(),
      batchId,
    },
  });

  logVprAudit({
    action: VPR_AUDIT_ACTIONS.VPR_AWARD,
    actorUserId,
    tournamentId: tournament.id,
    clubId,
    after: { batchId, entries: ledgerEntries.length },
  });

  return { ok: true, batchId, entries: ledgerEntries.length };
}

export async function tryAwardTournamentVpr(clubId, tournamentId, options = {}) {
  const tournament = getTournament(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải." };
  }

  if (isVprCloudSyncEnabled()) {
    const rpcResult = await rpcVprAwardTournament({
      clubId,
      tournamentId,
      tournamentSnapshot: tournament,
    });
    if (rpcResult.ok) {
      updateTournament(clubId, tournamentId, {
        vprAward: {
          status: VPR_AWARD_STATUS.AWARDED,
          awardedAt: new Date().toISOString(),
          batchId: rpcResult.batchId || createBatchId(),
        },
      });
      return rpcResult;
    }
    if (rpcResult.code !== "RPC_NOT_DEPLOYED" && rpcResult.code !== "NO_SUPABASE") {
      return rpcResult;
    }
  }

  return awardLocally(clubId, tournament, options.actorUserId);
}

export async function recalculateTournamentVpr(clubId, tournamentId, options = {}) {
  const tournament = getTournament(clubId, tournamentId);
  if (!tournament) {
    return { ok: false, error: "Không tìm thấy giải." };
  }

  removeLedgerByTournament(clubId, tournamentId);
  rebuildLeaderboardFromLedger();

  updateTournament(clubId, tournamentId, {
    vprAward: {
      status: VPR_AWARD_STATUS.PENDING,
      awardedAt: null,
      batchId: null,
    },
  });

  logVprAudit({
    action: VPR_AUDIT_ACTIONS.VPR_RECALCULATE,
    actorUserId: options.actorUserId,
    tournamentId,
    clubId,
    metadata: { mode: tournament.mode },
  });

  if (isVprCloudSyncEnabled()) {
    await rpcVprRecalculateTournament({ clubId, tournamentId });
  }

  return tryAwardTournamentVpr(clubId, tournamentId, options);
}

export function manualAdjustVprPoints({
  vprAthleteId,
  category,
  delta,
  reason,
  actorUserId = null,
  displayName = "",
  clubName = "",
  region = "",
}) {
  const points = Number(delta);
  if (!Number.isFinite(points) || points === 0) {
    return { ok: false, error: "Điểm điều chỉnh không hợp lệ." };
  }

  const entry = {
    id: `vpr-manual-${Date.now()}`,
    batchId: `manual-${Date.now()}`,
    clubId: "",
    tenantId: null,
    tournamentId: "manual",
    tournamentName: reason || "Điều chỉnh thủ công",
    tournamentLevel: "certified",
    category,
    placement: "participation",
    points,
    vprAthleteId,
    displayName,
    clubName,
    region,
    gender: "unknown",
    awardedAt: new Date().toISOString(),
    manual: true,
  };

  appendLedgerEntries([entry]);
  rebuildLeaderboardFromLedger();

  logVprAudit({
    action: VPR_AUDIT_ACTIONS.VPR_MANUAL_ADJUST,
    actorUserId,
    vprAthleteId,
    before: null,
    after: entry,
    metadata: { reason },
  });

  return { ok: true, entry };
}

export function listVprLedger(filters = {}) {
  let rows = listLedgerEntries();
  if (filters.category) {
    rows = rows.filter((row) => row.category === filters.category);
  }
  if (filters.tournamentId) {
    rows = rows.filter((row) => String(row.tournamentId) === String(filters.tournamentId));
  }
  if (filters.clubId) {
    rows = rows.filter((row) => row.clubId === filters.clubId);
  }
  return rows;
}

export { canAwardVprPoints };

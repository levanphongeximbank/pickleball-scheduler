import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { getAuthOptions } from "../../../auth/guardAction.js";
import { resolveTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { normalizeTeamData } from "../models/index.js";
import { computeTeamStandings } from "../engines/teamStandingsEngine.js";
import {
  isTeamTournamentCloudEnabled,
  resolveTeamTournamentStoreMode,
  TEAM_TOURNAMENT_STORE_MODES,
} from "../repositories/teamTournamentRepository.js";
import {
  rpcTeamTournamentAssignMember,
  rpcTeamTournamentConfirmSubMatch,
  rpcTeamTournamentGetSetup,
  rpcTeamTournamentGetStandings,
  rpcTeamTournamentLockMatchup,
  rpcTeamTournamentPublishMatchup,
  rpcTeamTournamentRemoveMember,
  rpcTeamTournamentSaveLineupDraft,
  rpcTeamTournamentSaveSubMatchDraft,
  rpcTeamTournamentSaveTeam,
  rpcTeamTournamentSetCaptain,
  rpcTeamTournamentSubmitLineup,
  rpcTeamTournamentUpsertStandings,
} from "./teamTournamentRpcService.js";

let testStoreModeOverride = null;

export function __setTeamTournamentStoreModeForTests(mode) {
  testStoreModeOverride = mode;
}

export function __resetTeamTournamentStoreModeForTests() {
  testStoreModeOverride = null;
}

export function getTeamTournamentSyncMode() {
  if (testStoreModeOverride) {
    return testStoreModeOverride;
  }
  return resolveTeamTournamentStoreMode();
}

export function shouldUseTeamTournamentCloud() {
  return getTeamTournamentSyncMode() === TEAM_TOURNAMENT_STORE_MODES.SUPABASE;
}

function cloudFallbackResult(rpcResult) {
  if (!rpcResult?.ok && rpcResult?.code !== "RPC_NOT_DEPLOYED") {
    return { cloudAttempted: true, cloudResult: rpcResult };
  }
  return { cloudAttempted: false, cloudResult: rpcResult };
}

function mapCloudTournamentToLocal(cloudTournament) {
  if (!cloudTournament) {
    return null;
  }

  return {
    id: cloudTournament.id,
    clubId: cloudTournament.clubId,
    tenantId: cloudTournament.tenantId,
    name: cloudTournament.name,
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    status: cloudTournament.status,
    events: [],
    settings: cloudTournament.settings || {},
    teamData: normalizeTeamData(cloudTournament.teamData || {}),
  };
}

export async function cloudEnsureTournamentHeader(tournament) {
  if (!shouldUseTeamTournamentCloud()) {
    return { ok: true, skipped: true };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const clubId = String(tournament?.clubId || "").trim();
  const tournamentId = String(tournament?.id || "").trim();
  let tenantId = String(tournament?.tenantId || "").trim();

  if (!tenantId) {
    const user = getAuthOptions()?.user;
    tenantId = String(user?.venueId || user?.venue_id || "").trim();
  }
  if (!tenantId) {
    tenantId = String(resolveTenantIdForClub(clubId) || "").trim();
  }

  if (!clubId || !tournamentId || !tenantId) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Thiếu tenant/club/tournament để đồng bộ cloud.",
    };
  }

  const teamData = tournament?.teamData || {};
  const { data, error } = await client
    .from("team_tournaments")
    .upsert(
      {
        tenant_id: tenantId,
        club_id: clubId,
        tournament_id: tournamentId,
        name: String(tournament?.name || "Giải đồng đội").trim(),
        status: String(tournament?.status || "draft").trim(),
        settings:
          teamData.settings && typeof teamData.settings === "object"
            ? teamData.settings
            : {},
      },
      { onConflict: "tenant_id,club_id,tournament_id" }
    )
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "CLOUD_HEADER_FAILED",
      error: error.message,
    };
  }

  return { ok: true, headerId: data?.id || null };
}

export async function cloudGetTeamTournamentSetup(tournamentId, viewerTeamId = null) {
  if (!shouldUseTeamTournamentCloud()) {
    return { ok: false, code: "CLOUD_DISABLED" };
  }

  const result = await rpcTeamTournamentGetSetup(tournamentId, viewerTeamId);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    tournament: mapCloudTournamentToLocal(result.tournament),
    provider: result.provider,
  };
}

export async function cloudSyncStandingsAfterMutation(tournament) {
  if (!shouldUseTeamTournamentCloud() || !tournament?.id) {
    return { ok: false, code: "CLOUD_DISABLED" };
  }

  const teamData = tournament.teamData || {};
  const computed = computeTeamStandings(teamData);
  const standings = computed.standings || [];
  const result = await rpcTeamTournamentUpsertStandings(tournament.id, standings);

  return { ...result, standings };
}

export async function tryCloudMutation(rpcCall, { fallbackLabel = "blob" } = {}) {
  if (!shouldUseTeamTournamentCloud()) {
    return { ok: true, usedCloud: false, fallback: fallbackLabel };
  }

  const result = await rpcCall();
  const meta = cloudFallbackResult(result);

  if (result.ok) {
    return { ok: true, usedCloud: true, cloudResult: result };
  }

  if (result.code === "RPC_NOT_DEPLOYED" || result.code === "NO_SUPABASE") {
    return { ok: true, usedCloud: false, fallback: fallbackLabel, cloudResult: result };
  }

  return {
    ok: false,
    usedCloud: true,
    error: result.error || "Cloud sync thất bại.",
    code: result.code,
    cloudResult: result,
    ...meta,
  };
}

export async function cloudCaptainSaveLineup(tournamentId, payload) {
  return tryCloudMutation(() =>
    rpcTeamTournamentSaveLineupDraft(
      tournamentId,
      payload.matchupId,
      payload.teamId,
      payload.selections || {}
    )
  );
}

export async function cloudCaptainSubmitLineup(tournamentId, payload) {
  return tryCloudMutation(() =>
    rpcTeamTournamentSubmitLineup(
      tournamentId,
      payload.matchupId,
      payload.teamId,
      payload.selections || {}
    )
  );
}

export async function cloudOrganizerLockLineups(tournamentId, payload) {
  return tryCloudMutation(() =>
    rpcTeamTournamentLockMatchup(tournamentId, payload.matchupId)
  );
}

export async function cloudOrganizerPublishLineups(tournamentId, payload) {
  return tryCloudMutation(() =>
    rpcTeamTournamentPublishMatchup(tournamentId, payload.matchupId)
  );
}

export async function cloudRefereeSaveSubMatchDraft(tournamentId, payload) {
  return tryCloudMutation(() =>
    rpcTeamTournamentSaveSubMatchDraft(
      tournamentId,
      payload.matchupId,
      payload.subMatchId,
      {
        teamA: payload.score?.teamA ?? payload.teamA ?? 0,
        teamB: payload.score?.teamB ?? payload.teamB ?? 0,
        games: payload.games || payload.score?.games || [],
      }
    )
  );
}

export async function cloudRefereeConfirmSubMatch(tournamentId, payload) {
  return tryCloudMutation(() =>
    rpcTeamTournamentConfirmSubMatch(
      tournamentId,
      payload.matchupId,
      payload.subMatchId,
      {
        teamA: payload.score?.teamA ?? payload.teamA ?? 0,
        teamB: payload.score?.teamB ?? payload.teamB ?? 0,
        games: payload.games || payload.score?.games || [],
      },
      payload.winnerTeamId || null
    )
  );
}

export async function cloudSaveTeam(tournamentId, team) {
  return tryCloudMutation(() => rpcTeamTournamentSaveTeam(tournamentId, team));
}

export async function cloudAssignMember(tournamentId, teamId, playerId) {
  return tryCloudMutation(() =>
    rpcTeamTournamentAssignMember(tournamentId, teamId, playerId)
  );
}

export async function cloudRemoveMember(tournamentId, teamId, playerId) {
  return tryCloudMutation(() =>
    rpcTeamTournamentRemoveMember(tournamentId, teamId, playerId)
  );
}

export async function cloudSetCaptain(tournamentId, teamId, playerId, deputyIds = []) {
  return tryCloudMutation(() =>
    rpcTeamTournamentSetCaptain(tournamentId, teamId, playerId, deputyIds)
  );
}

export async function cloudGetStandings(tournamentId) {
  if (!shouldUseTeamTournamentCloud()) {
    return { ok: false, code: "CLOUD_DISABLED" };
  }
  return rpcTeamTournamentGetStandings(tournamentId);
}

export { isTeamTournamentCloudEnabled };

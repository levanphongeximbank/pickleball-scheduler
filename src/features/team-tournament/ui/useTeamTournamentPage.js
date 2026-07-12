import { useCallback, useEffect, useRef, useState } from "react";
import { findTournamentClubId } from "../../club/services/clubTournamentBridge.js";
import {
  getTeamTournamentUiOrchestrator,
  mapRepositoryResultToUi,
} from "./teamTournamentUiOrchestrator.js";
import { REPOSITORY_REALTIME_FALLBACK } from "../repositories/teamTournamentRepositoryTypes.js";
import { syncDreambreakerForAllMatchups } from "../engines/dreambreakerEngine.js";

const DEFAULT_POLL_MS = REPOSITORY_REALTIME_FALLBACK.pollingIntervalMs;

/**
 * TT-1C page hook — repository read path + polling + mutation helpers.
 * @param {{ clubId?: string, tournamentId?: string, pollingEnabled?: boolean, pollIntervalMs?: number }} params
 */
export function useTeamTournamentPage({
  clubId,
  tournamentId,
  pollingEnabled = true,
  pollIntervalMs = DEFAULT_POLL_MS,
} = {}) {
  const orchestrator = getTeamTournamentUiOrchestrator();
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [aggregate, setAggregate] = useState(null);
  const [version, setVersion] = useState(1);
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [versionConflict, setVersionConflict] = useState(false);
  const [serverTime, setServerTime] = useState(null);
  const [lineupDeadline, setLineupDeadline] = useState(null);
  const [canSaveDraft, setCanSaveDraft] = useState(null);
  const [canSubmit, setCanSubmit] = useState(null);
  const [deadlineStatus, setDeadlineStatus] = useState(null);
  const pollRef = useRef(null);
  const loadingRef = useRef(false);

  const applyLoadResult = useCallback((result) => {
    if (!result.ok) {
      setError(result.error || "Không tải được giải.");
      setTournament(null);
      setTeamData(null);
      setAggregate(null);
      setServerTime(null);
      setLineupDeadline(null);
      setCanSaveDraft(null);
      setCanSubmit(null);
      setDeadlineStatus(null);
      return false;
    }

    setError(null);
    setVersionConflict(false);
    setTournament(result.tournament);
    setAggregate(result.aggregate);
    setVersion(result.version ?? 1);
    setProvider(result.provider);

    const rawTeamData = result.teamData || result.aggregate?.teamData;
    const synced = rawTeamData
      ? syncDreambreakerForAllMatchups(rawTeamData).teamData
      : null;
    setTeamData(synced);
    setDataVersion((v) => v + 1);
    setServerTime(result.serverTime ?? null);
    setLineupDeadline(result.lineupDeadline ?? null);
    setCanSaveDraft(result.canSaveDraft ?? null);
    setCanSubmit(result.canSubmit ?? null);
    setDeadlineStatus(result.deadlineStatus ?? null);
    return true;
  }, []);

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      const effectiveClubId = clubId || findTournamentClubId(tournamentId);
      if (!tournamentId) {
        setLoading(false);
        return { ok: false, error: "Thiếu clubId hoặc tournamentId." };
      }

      const loadClubId = effectiveClubId || tournamentId;

      if (loadingRef.current && !silent) {
        return { ok: false, error: "Đang tải..." };
      }

      loadingRef.current = true;
      if (!silent) {
        setLoading(true);
      }

      const result = await orchestrator.loadTournament(loadClubId, tournamentId);
      applyLoadResult(result);
      setLoading(false);
      loadingRef.current = false;
      return result;
    },
    [applyLoadResult, clubId, orchestrator, tournamentId]
  );

  const runMutation = useCallback(
    async ({ method, payload, commandOptions, actionScope, expectedVersion }) => {
      if (!clubId || !tournamentId) {
        return { ok: false, error: "Thiếu clubId hoặc tournamentId." };
      }

      const result = await orchestrator.runMutation({
        method,
        clubId,
        tournamentId,
        payload,
        commandOptions,
        actionScope,
        expectedVersion: expectedVersion ?? version,
      });

      if (result.isVersionConflict) {
        setVersionConflict(true);
        await reload({ silent: true });
        return result;
      }

      if (result.ok) {
        setVersionConflict(false);
        if (result.tournament) {
          setTournament(result.tournament);
          const synced = result.teamData
            ? syncDreambreakerForAllMatchups(result.teamData).teamData
            : null;
          setTeamData(synced);
          setAggregate(result.aggregate);
          setVersion(result.version ?? version);
          setDataVersion((v) => v + 1);
        }
      }

      return result;
    },
    [clubId, orchestrator, reload, tournamentId, version]
  );

  const patchTeamData = useCallback(
    (patch) => {
      if (!clubId || !tournamentId) {
        return { ok: false, error: "Thiếu clubId hoặc tournamentId." };
      }
      const result = orchestrator.patchTeamData(clubId, tournamentId, patch);
      if (result.ok && result.data) {
        reload({ silent: true });
      }
      return result;
    },
    [clubId, orchestrator, reload, tournamentId]
  );

  const getVisibleLineups = useCallback(
    async (matchupId, readOptions = {}) => {
      if (!clubId || !tournamentId) {
        return { ok: false, error: "Thiếu clubId hoặc tournamentId." };
      }
      return orchestrator.getVisibleLineups(clubId, tournamentId, {
        matchupId,
        ...readOptions,
      });
    },
    [clubId, orchestrator, tournamentId]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!pollingEnabled || !clubId || !tournamentId) {
      return undefined;
    }

    function startPolling() {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      pollRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) {
          return;
        }
        reload({ silent: true });
      }, pollIntervalMs);
    }

    function stopPolling() {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        reload({ silent: true });
        startPolling();
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [clubId, pollIntervalMs, pollingEnabled, reload, tournamentId]);

  return {
    loading,
    tournament,
    teamData,
    aggregate,
    version,
    provider,
    mode: orchestrator.getMode(),
    isCloudPrimary: orchestrator.getMode() === "cloud_primary",
    error,
    dataVersion,
    versionConflict,
    serverTime,
    lineupDeadline,
    canSaveDraft,
    canSubmit,
    deadlineStatus,
    reload,
    runMutation,
    saveSubMatchDraft: (payload, commandOptions) =>
      orchestrator.saveSubMatchDraft(clubId, tournamentId, payload, commandOptions),
    patchTeamData,
    getVisibleLineups,
    mapRepositoryResultToUi,
  };
}

export function __resetTeamTournamentPagePollingForTests() {
  // hook cleanup is per-mount; tests use fresh render
}

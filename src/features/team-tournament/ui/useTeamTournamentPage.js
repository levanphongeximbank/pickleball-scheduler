import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildTournamentNotFoundMessage,
  resolveTournamentClubId,
} from "../../club/services/clubTournamentBridge.js";
import {
  getTeamTournamentUiOrchestrator,
  mapRepositoryResultToUi,
  UI_MUTATION_ERROR,
} from "./teamTournamentUiOrchestrator.js";
import {
  REPOSITORY_ERROR_CODES,
  REPOSITORY_REALTIME_FALLBACK,
} from "../repositories/teamTournamentRepositoryTypes.js";
import { syncDreambreakerForAllMatchups } from "../engines/dreambreakerEngine.js";
import { useTeamTournamentRealtime } from "./useTeamTournamentRealtime.js";
import {
  computeTournamentRosterSetupSignature,
} from "../engines/teamRosterHydrationCache.js";
import { logTeamRosterHydrationTransition } from "../engines/teamRosterHydrationDiagnostics.js";
import { isSetupMutationFoundationEnabled } from "../setup/setupMutationFeatureGate.js";

const DEFAULT_POLL_MS = REPOSITORY_REALTIME_FALLBACK.pollingIntervalMs;

function isTeamTournamentNotFound(result) {
  const code = String(result?.code || "");
  return (
    code === REPOSITORY_ERROR_CODES.NOT_FOUND ||
    code === UI_MUTATION_ERROR.NOT_FOUND ||
    code === "NOT_FOUND"
  );
}

/**
 * Pure helper for tests: resolve club for Team detail load (preferred → scan).
 * @param {string|null|undefined} preferredClubId
 * @param {string|null|undefined} tournamentId
 */
export function resolveTeamTournamentLoadClubId(preferredClubId, tournamentId) {
  // Only return a club that actually hosts the tournament (never a guess).
  return resolveTournamentClubId(preferredClubId, tournamentId);
}

/**
 * TT-1C page hook — repository read path + polling + mutation helpers.
 * TT-6C: realtime subscription via useTeamTournamentRealtime (repository boundary).
 * @param {{ clubId?: string, tournamentId?: string, pollingEnabled?: boolean, pollIntervalMs?: number, realtimeEnabled?: boolean }} params
 */
export function useTeamTournamentPage({
  clubId,
  tournamentId,
  pollingEnabled = true,
  pollIntervalMs = DEFAULT_POLL_MS,
  realtimeEnabled = true,
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
  const [rosterSetupRevision, setRosterSetupRevision] = useState(0);
  const [versionConflict, setVersionConflict] = useState(false);
  const [serverTime, setServerTime] = useState(null);
  const [lineupDeadline, setLineupDeadline] = useState(null);
  const [canSaveDraft, setCanSaveDraft] = useState(null);
  const [canSubmit, setCanSubmit] = useState(null);
  const [deadlineStatus, setDeadlineStatus] = useState(null);
  const [schemaVersion, setSchemaVersion] = useState(null);
  const [snapshotMeta, setSnapshotMeta] = useState(null);
  const [diagnostic, setDiagnostic] = useState(null);
  const [driftDetected, setDriftDetected] = useState(false);
  const [setupBlocked, setSetupBlocked] = useState(false);
  const [setupBlockCode, setSetupBlockCode] = useState(null);
  const [setupMutationStatus, setSetupMutationStatus] = useState("idle");
  const [latestTournamentVersion, setLatestTournamentVersion] = useState(1);
  const rosterSignatureRef = useRef("");
  const pollRef = useRef(null);
  const loadingRef = useRef(false);
  const reloadFnRef = useRef(null);

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
      setSchemaVersion(null);
      setSnapshotMeta(null);
      setDiagnostic(null);
      setDriftDetected(false);
      setSetupBlocked(false);
      setSetupBlockCode(null);
      return false;
    }

    setError(null);
    setVersionConflict(false);
    setTournament(result.tournament);
    setAggregate(result.aggregate);
    setVersion(result.version ?? 1);
    setProvider(result.provider);
    setSchemaVersion(result.schemaVersion ?? null);
    setSnapshotMeta(result.snapshotMeta ?? null);
    setDiagnostic(result.diagnostic ?? null);
    setDriftDetected(result.driftDetected === true);
    setSetupBlocked(result.setupBlocked === true);
    setSetupBlockCode(result.setupBlockCode ?? null);
    setLatestTournamentVersion(result.latestTournamentVersion ?? result.version ?? 1);

    const rawTeamData = result.teamData || result.aggregate?.teamData;
    const synced = rawTeamData
      ? syncDreambreakerForAllMatchups(rawTeamData).teamData
      : null;

    const nextRosterSignature = computeTournamentRosterSetupSignature(synced);
    const rosterChanged = nextRosterSignature !== rosterSignatureRef.current;
    if (rosterChanged) {
      rosterSignatureRef.current = nextRosterSignature;
      setRosterSetupRevision((v) => v + 1);
      logTeamRosterHydrationTransition("useTeamTournamentPage.rosterSetupRevision", {
        tournamentId: result.tournament?.id,
        setupVersion: result.version,
        rosterChanged: true,
        reloadTrigger: "applyLoadResult",
      });
    }

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
    async ({ silent = false, schemaVersion: readSchemaVersion, diagnostic: readDiagnostic } = {}) => {
      if (!tournamentId) {
        const missing = { ok: false, error: "Thiếu tournamentId.", code: "MISSING_ID" };
        applyLoadResult(missing);
        setLoading(false);
        return missing;
      }

      // Never fall back to tournamentId as clubId — that creates a dead deep-link load.
      const loadClubId = resolveTeamTournamentLoadClubId(clubId, tournamentId);

      if (!loadClubId) {
        const missingClub = {
          ok: false,
          code: REPOSITORY_ERROR_CODES.NOT_FOUND,
          error: buildTournamentNotFoundMessage(tournamentId, {
            kind: "giải đồng đội",
          }),
        };
        applyLoadResult(missingClub);
        setLoading(false);
        return missingClub;
      }

      if (loadingRef.current && !silent) {
        return { ok: false, error: "Đang tải..." };
      }

      loadingRef.current = true;
      if (!silent) {
        setLoading(true);
      }

      logTeamRosterHydrationTransition("useTeamTournamentPage.reload.start", {
        tournamentId,
        clubId: loadClubId,
        silent,
        reloadTrigger: silent ? "silent" : "explicit",
      });

      const readOptions = {};
      if (readSchemaVersion != null) {
        readOptions.schemaVersion = Number(readSchemaVersion);
      } else if (
        isSetupMutationFoundationEnabled() &&
        ["cloud_primary", "cloud_only"].includes(orchestrator.getMode())
      ) {
        readOptions.schemaVersion = 7;
      }
      if (readDiagnostic === true) {
        readOptions.diagnostic = true;
      }

      let result = await orchestrator.loadTournament(loadClubId, tournamentId, readOptions);

      // Preferred activeClub may still miss (race / stale cache): rescan once.
      if (!result.ok && isTeamTournamentNotFound(result)) {
        const rescannedClubId = resolveTournamentClubId(null, tournamentId);
        if (rescannedClubId && rescannedClubId !== loadClubId) {
          result = await orchestrator.loadTournament(rescannedClubId, tournamentId, readOptions);
        }
      }

      if (!result.ok && isTeamTournamentNotFound(result)) {
        result = {
          ...result,
          error: buildTournamentNotFoundMessage(tournamentId, {
            kind: "giải đồng đội",
          }),
        };
      }

      applyLoadResult(result);
      setLoading(false);
      loadingRef.current = false;
      logTeamRosterHydrationTransition("useTeamTournamentPage.reload.done", {
        tournamentId,
        ok: result.ok,
        silent,
        setupVersion: result.version,
      });
      return result;
    },
    [applyLoadResult, clubId, orchestrator, tournamentId]
  );

  reloadFnRef.current = reload;

  const realtime = useTeamTournamentRealtime({
    clubId,
    tournamentId,
    enabled: realtimeEnabled && Boolean(clubId && tournamentId),
    onReload: useCallback((options) => reloadFnRef.current?.(options), []),
  });

  const effectivePollingEnabled = pollingEnabled && realtime.pollingFallbackActive;

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
          const nextSignature = computeTournamentRosterSetupSignature(synced);
          if (nextSignature !== rosterSignatureRef.current) {
            rosterSignatureRef.current = nextSignature;
            setRosterSetupRevision((v) => v + 1);
          }
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

  const persistSetupTeamData = useCallback(
    async (nextTeamData, options = {}) => {
      if (!clubId || !tournamentId) {
        return { ok: false, error: "Thiếu clubId hoặc tournamentId." };
      }
      const result = await orchestrator.persistSetupTeamData(clubId, tournamentId, nextTeamData, {
        previousTeamData: teamData,
        tournament,
        expectedTournamentVersion: version,
        ...options,
      });
      if (result.ok) {
        const loaded = result.tournament
          ? result
          : await reload({ silent: true, schemaVersion: 7 });
        if (loaded.ok) {
          applyLoadResult(loaded);
        }
      }
      return result;
    },
    [
      applyLoadResult,
      clubId,
      orchestrator,
      reload,
      teamData,
      tournament,
      tournamentId,
      version,
    ]
  );

  const saveDraft = useCallback(
    async (options = {}) => {
      if (!clubId || !tournamentId) {
        return { ok: false, error: "Thiếu clubId hoặc tournamentId." };
      }
      const result = await orchestrator.saveDraft(clubId, tournamentId, {
        teamData,
        tournament,
        aggregate,
        expectedTournamentVersion: version,
        ...options,
      });
      if (result.isVersionConflict) {
        setVersionConflict(true);
        await reload({ silent: true, schemaVersion: 7 });
        return result;
      }
      if (result.ok) {
        const loaded = result.tournament
          ? result
          : await reload({ silent: true, schemaVersion: 7 });
        if (loaded.ok) {
          applyLoadResult(loaded);
        }
      }
      return result;
    },
    [
      aggregate,
      applyLoadResult,
      clubId,
      orchestrator,
      reload,
      teamData,
      tournament,
      tournamentId,
      version,
    ]
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
    if (!effectivePollingEnabled || !clubId || !tournamentId) {
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
  }, [clubId, effectivePollingEnabled, pollIntervalMs, reload, tournamentId]);

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
    rosterSetupRevision,
    versionConflict,
    serverTime,
    lineupDeadline,
    canSaveDraft,
    canSubmit,
    deadlineStatus,
    schemaVersion,
    snapshotMeta,
    diagnostic,
    driftDetected,
    setupBlocked,
    setupBlockCode,
    setupMutationStatus,
    latestTournamentVersion,
    setSetupMutationStatus,
    reload,
    runMutation,
    saveSubMatchDraft: (payload, commandOptions) =>
      orchestrator.saveSubMatchDraft(clubId, tournamentId, payload, commandOptions),
    patchTeamData,
    persistSetupTeamData,
    saveDraft,
    getVisibleLineups,
    getLineupOverrideOps: (matchupId, teamId) =>
      orchestrator.getLineupOverrideOps(clubId, tournamentId, { matchupId, teamId }),
    mapRepositoryResultToUi,
    realtime,
    connectionState: realtime.connectionState,
    isRealtime: realtime.isRealtime,
    isDegraded: realtime.isDegraded,
    lastEventAt: realtime.lastEventAt,
    lastSnapshotAt: realtime.lastSnapshotAt,
    reconnectRealtime: realtime.reconnect,
    refreshRealtime: realtime.refresh,
    subscriptionError: realtime.subscriptionError,
    pollingFallbackActive: realtime.pollingFallbackActive,
  };
}

export function __resetTeamTournamentPagePollingForTests() {
  // hook cleanup is per-mount; tests use fresh render
}

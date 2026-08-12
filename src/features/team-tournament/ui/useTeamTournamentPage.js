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
import { attachPersistedDreambreakerProjection } from "../engines/dreambreakerProjection.js";
import { useTeamTournamentRealtime } from "./useTeamTournamentRealtime.js";
import {
  computeTournamentRosterSetupSignature,
} from "../engines/teamRosterHydrationCache.js";
import { logTeamRosterHydrationTransition } from "../engines/teamRosterHydrationDiagnostics.js";
import { isSetupMutationFoundationEnabled } from "../setup/setupMutationFeatureGate.js";
import {
  commitCanonicalSetupLoad,
  createCanonicalSetupRefreshController,
  resolveCanonicalReloadApply,
  refreshCanonicalSetupAfterMutation,
} from "./canonicalSetupRefresh.js";

const DEFAULT_POLL_MS = REPOSITORY_REALTIME_FALLBACK.pollingIntervalMs;

function isTeamTournamentNotFound(result) {
  const code = String(result?.code || "");
  return (
    code === REPOSITORY_ERROR_CODES.NOT_FOUND ||
    code === UI_MUTATION_ERROR.NOT_FOUND ||
    code === "NOT_FOUND"
  );
}

function isCloudPrimaryMode(mode) {
  return ["cloud_primary", "cloud_only"].includes(String(mode || ""));
}

/**
 * Pure helper for tests: resolve club for Team detail load (preferred → scan → preferred fallback).
 * Preferred fallback covers V2 membership captains whose browser has no hosting blob yet;
 * cloud repository still returns NOT_FOUND when the club/tournament pair is wrong.
 * @param {string|null|undefined} preferredClubId
 * @param {string|null|undefined} tournamentId
 */
export function resolveTeamTournamentLoadClubId(preferredClubId, tournamentId) {
  const resolved = resolveTournamentClubId(preferredClubId, tournamentId);
  if (resolved) {
    return resolved;
  }
  const preferred = String(preferredClubId || "").trim();
  return preferred || null;
}

/**
 * Whether page load may proceed without a resolved local clubId (cloud get_setup is tournament-id keyed).
 * @param {string|null|undefined} mode
 */
export function canLoadTeamTournamentWithoutLocalClub(mode) {
  return isCloudPrimaryMode(mode);
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
  pageMode = null,
} = {}) {
  const orchestrator = getTeamTournamentUiOrchestrator();
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [aggregate, setAggregate] = useState(null);
  const [version, setVersion] = useState(1);
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
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
  const refreshControllerRef = useRef(createCanonicalSetupRefreshController());

  const applyLoadResult = useCallback((result) => {
    if (!result.ok) {
      setError(result.error || "Không tải được giải.");
      setErrorCode(result.code || null);
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
    setErrorCode(null);
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
    const mode = orchestrator.getMode?.() || orchestrator.mode;
    const synced = rawTeamData
      ? isCloudPrimaryMode(mode)
        ? attachPersistedDreambreakerProjection(rawTeamData)
        : syncDreambreakerForAllMatchups(rawTeamData).teamData
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
  }, [orchestrator]);

  const loadCanonicalSetup = useCallback(
    async ({
      schemaVersion: readSchemaVersion,
      diagnostic: readDiagnostic,
    } = {}) => {
      if (!tournamentId) {
        return { ok: false, error: "Thiếu tournamentId.", code: "MISSING_ID" };
      }

      // Never fall back to tournamentId as clubId — that creates a dead deep-link load.
      const mode = orchestrator.getMode();
      const loadClubId = resolveTeamTournamentLoadClubId(clubId, tournamentId);
      const allowCloudWithoutClub = canLoadTeamTournamentWithoutLocalClub(mode);

      if (!loadClubId && !allowCloudWithoutClub) {
        return {
          ok: false,
          code: REPOSITORY_ERROR_CODES.NOT_FOUND,
          error: buildTournamentNotFoundMessage(tournamentId, {
            kind: "giải đồng đội",
          }),
        };
      }

      // Cloud get_setup is tournament-id keyed; empty clubId only disables local blob fallback.
      const effectiveLoadClubId = loadClubId || "";

      const readOptions = {};
      if (pageMode) {
        readOptions.pageMode = String(pageMode);
      }
      if (readSchemaVersion != null) {
        readOptions.schemaVersion = Number(readSchemaVersion);
      } else if (
        isSetupMutationFoundationEnabled() &&
        isCloudPrimaryMode(mode)
      ) {
        readOptions.schemaVersion = 7;
      }
      if (readDiagnostic === true) {
        readOptions.diagnostic = true;
      }

      let result = await orchestrator.loadTournament(
        effectiveLoadClubId,
        tournamentId,
        readOptions
      );

      // Preferred activeClub may still miss (race / stale cache): rescan once.
      if (!result.ok && isTeamTournamentNotFound(result)) {
        const rescannedClubId = resolveTournamentClubId(null, tournamentId);
        if (rescannedClubId && rescannedClubId !== effectiveLoadClubId) {
          result = await orchestrator.loadTournament(
            rescannedClubId,
            tournamentId,
            readOptions
          );
        }
      }

      // Only rewrite to Preview/blob copy when we never reached cloud (local modes).
      // Cloud NOT_FOUND / FORBIDDEN keep the RPC message so captains see the real cause.
      if (
        !result.ok &&
        isTeamTournamentNotFound(result) &&
        !allowCloudWithoutClub
      ) {
        result = {
          ...result,
          error: buildTournamentNotFoundMessage(tournamentId, {
            kind: "giải đồng đội",
          }),
        };
      } else if (!result.ok && isTeamTournamentNotFound(result) && allowCloudWithoutClub) {
        result = {
          ...result,
          error:
            result.error ||
            `Không tìm thấy giải đồng đội trên cloud (id: ${tournamentId}).`,
        };
      }

      return result;
    },
    [clubId, orchestrator, pageMode, tournamentId]
  );

  const reload = useCallback(
    async ({
      silent = false,
      schemaVersion: readSchemaVersion,
      diagnostic: readDiagnostic,
      applyUi = true,
      reason = null,
    } = {}) => {
      if (!tournamentId) {
        const missing = { ok: false, error: "Thiếu tournamentId.", code: "MISSING_ID" };
        if (applyUi !== false) {
          applyLoadResult(missing);
          setLoading(false);
        }
        return { ...missing, applied: applyUi !== false, stale: false };
      }

      // Peek/version-only reads must not touch React state or bump reload generation.
      if (applyUi === false) {
        return {
          ...(await loadCanonicalSetup({
            schemaVersion: readSchemaVersion,
            diagnostic: readDiagnostic,
          })),
          applied: false,
          stale: false,
          refreshReason: reason || "peek_only",
        };
      }

      // Silent poll/realtime must not apply (or bump generation) during an active
      // mutation barrier — captain-confirm owns the next canonical commit.
      if (silent && refreshControllerRef.current.isMutationBarrierActive()) {
        return {
          ok: true,
          applied: false,
          stale: true,
          refreshReason: "mutation_barrier",
          generation: refreshControllerRef.current.getGeneration(),
        };
      }

      if (loadingRef.current && !silent) {
        return { ok: false, error: "Đang tải...", applied: false, stale: false };
      }

      const mode = orchestrator.getMode();
      const loadClubId = resolveTeamTournamentLoadClubId(clubId, tournamentId);
      const allowCloudWithoutClub = canLoadTeamTournamentWithoutLocalClub(mode);
      const effectiveLoadClubId = loadClubId || "";

      loadingRef.current = true;
      if (!silent) {
        setLoading(true);
      }

      const generation = refreshControllerRef.current.beginReload();

      logTeamRosterHydrationTransition("useTeamTournamentPage.reload.start", {
        tournamentId,
        clubId: effectiveLoadClubId || null,
        silent,
        reloadTrigger: reason || (silent ? "silent" : "explicit"),
        cloudWithoutClub: !loadClubId && allowCloudWithoutClub,
        generation,
      });

      const result = await loadCanonicalSetup({
        schemaVersion: readSchemaVersion,
        diagnostic: readDiagnostic,
      });

      const decision = resolveCanonicalReloadApply(
        refreshControllerRef.current,
        generation,
        { applyUi: true }
      );

      if (decision.apply) {
        applyLoadResult(result);
        setLoading(false);
        loadingRef.current = false;
      } else if (!refreshControllerRef.current.isMutationBarrierActive()) {
        // A newer reload owns loading; do not clear its in-flight flag.
        if (refreshControllerRef.current.getGeneration() === generation) {
          setLoading(false);
          loadingRef.current = false;
        }
      }

      logTeamRosterHydrationTransition("useTeamTournamentPage.reload.done", {
        tournamentId,
        ok: result.ok,
        silent,
        setupVersion: result.version,
        applied: decision.apply,
        stale: decision.stale,
        generation,
      });

      return {
        ...result,
        applied: decision.apply,
        stale: decision.stale,
        refreshReason: decision.reason,
        generation,
      };
    },
    [applyLoadResult, clubId, loadCanonicalSetup, orchestrator, tournamentId]
  );

  const refreshAfterMutation = useCallback(
    async (options = {}) => {
      return refreshCanonicalSetupAfterMutation({
        controller: refreshControllerRef.current,
        loadSetup: loadCanonicalSetup,
        applyLoadResult: (result) => {
          applyLoadResult(result);
          setLoading(false);
          loadingRef.current = false;
        },
        loadOptions: {
          schemaVersion: 7,
          ...options,
        },
      });
    },
    [applyLoadResult, loadCanonicalSetup]
  );

  const runWithMutationBarrier = useCallback(async (fn) => {
    refreshControllerRef.current.beginMutationBarrier();
    try {
      return await fn();
    } finally {
      refreshControllerRef.current.endMutationBarrier();
    }
  }, []);

  const beginMutationBarrier = useCallback(
    () => refreshControllerRef.current.beginMutationBarrier(),
    []
  );
  const endMutationBarrier = useCallback(
    () => refreshControllerRef.current.endMutationBarrier(),
    []
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

      refreshControllerRef.current.beginMutationBarrier();
      try {
        const result = await orchestrator.runMutation({
          method,
          clubId,
          tournamentId,
          payload,
          commandOptions,
          actionScope,
          expectedVersion: expectedVersion ?? version,
          readOptions: pageMode ? { pageMode: String(pageMode) } : {},
        });

        if (result.isVersionConflict) {
          setVersionConflict(true);
          await refreshAfterMutation({ reason: "version_conflict" });
          return result;
        }

        if (result.ok) {
          setVersionConflict(false);
          if (pageMode) {
            await refreshAfterMutation({ reason: `mutation:${method}` });
          } else if (result.tournament) {
            commitCanonicalSetupLoad(
              refreshControllerRef.current,
              applyLoadResult,
              result
            );
          } else {
            await refreshAfterMutation({ reason: `mutation:${method}` });
          }
        }

        return result;
      } finally {
        refreshControllerRef.current.endMutationBarrier();
      }
    },
    [applyLoadResult, clubId, orchestrator, pageMode, refreshAfterMutation, tournamentId, version]
  );

  const patchTeamData = useCallback(
    (patch) => {
      if (!clubId || !tournamentId) {
        return { ok: false, error: "Thiếu clubId hoặc tournamentId." };
      }
      const result = orchestrator.patchTeamData(clubId, tournamentId, patch);
      if (result.ok && result.data) {
        void refreshAfterMutation({ reason: "patch_team_data" });
      }
      return result;
    },
    [clubId, orchestrator, refreshAfterMutation, tournamentId]
  );

  const persistSetupTeamData = useCallback(
    async (nextTeamData, options = {}) => {
      if (!clubId || !tournamentId) {
        return { ok: false, error: "Thiếu clubId hoặc tournamentId." };
      }
      refreshControllerRef.current.beginMutationBarrier();
      try {
        const result = await orchestrator.persistSetupTeamData(clubId, tournamentId, nextTeamData, {
          previousTeamData: teamData,
          tournament,
          expectedTournamentVersion: version,
          ...options,
        });
        if (result.ok) {
          if (pageMode) {
            await refreshAfterMutation({ reason: "persist_setup_readback" });
          } else {
            const loaded = result.tournament
              ? result
              : await loadCanonicalSetup({ schemaVersion: 7 });
            if (loaded.ok) {
              commitCanonicalSetupLoad(
                refreshControllerRef.current,
                applyLoadResult,
                loaded
              );
            } else {
              await refreshAfterMutation({ reason: "persist_setup_readback" });
            }
          }
        }
        return result;
      } finally {
        refreshControllerRef.current.endMutationBarrier();
      }
    },
    [
      applyLoadResult,
      clubId,
      loadCanonicalSetup,
      orchestrator,
      pageMode,
      refreshAfterMutation,
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
      refreshControllerRef.current.beginMutationBarrier();
      try {
        const result = await orchestrator.saveDraft(clubId, tournamentId, {
          teamData,
          tournament,
          aggregate,
          expectedTournamentVersion: version,
          ...options,
        });
        if (result.isVersionConflict) {
          setVersionConflict(true);
          await refreshAfterMutation({ reason: "draft_version_conflict" });
          return result;
        }
        if (result.ok) {
          if (pageMode) {
            await refreshAfterMutation({ reason: "save_draft_readback" });
          } else {
            const loaded = result.tournament
              ? result
              : await loadCanonicalSetup({ schemaVersion: 7 });
            if (loaded.ok) {
              commitCanonicalSetupLoad(
                refreshControllerRef.current,
                applyLoadResult,
                loaded
              );
            } else {
              await refreshAfterMutation({ reason: "save_draft_readback" });
            }
          }
        }
        return result;
      } finally {
        refreshControllerRef.current.endMutationBarrier();
      }
    },
    [
      aggregate,
      applyLoadResult,
      clubId,
      loadCanonicalSetup,
      orchestrator,
      pageMode,
      refreshAfterMutation,
      teamData,
      tournament,
      tournamentId,
      version,
    ]
  );

  const persistFormatVenueSetup = useCallback(
    async (config = {}, options = {}) => {
      if (!clubId || !tournamentId) {
        return { ok: false, error: "Thiếu clubId hoặc tournamentId." };
      }
      refreshControllerRef.current.beginMutationBarrier();
      try {
        const result = await orchestrator.persistFormatVenueSetup(
          clubId,
          tournamentId,
          config,
          {
            teamData,
            tournament,
            aggregate,
            expectedTournamentVersion: version,
            ...options,
          }
        );
        if (result.isVersionConflict) {
          setVersionConflict(true);
          await refreshAfterMutation({ reason: "format_venue_version_conflict" });
          return result;
        }
        if (result.ok) {
          if (pageMode) {
            await refreshAfterMutation({ reason: "format_venue_readback" });
          } else {
            const loaded = result.tournament
              ? result
              : await loadCanonicalSetup({ schemaVersion: 7 });
            if (loaded.ok) {
              commitCanonicalSetupLoad(
                refreshControllerRef.current,
                applyLoadResult,
                loaded
              );
            } else {
              await refreshAfterMutation({ reason: "format_venue_readback" });
            }
          }
        }
        return result;
      } finally {
        refreshControllerRef.current.endMutationBarrier();
      }
    },
    [
      aggregate,
      applyLoadResult,
      clubId,
      loadCanonicalSetup,
      orchestrator,
      pageMode,
      refreshAfterMutation,
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
    errorCode,
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
    refreshAfterMutation,
    runWithMutationBarrier,
    beginMutationBarrier,
    endMutationBarrier,
    runMutation,
    saveSubMatchDraft: (payload, commandOptions) =>
      orchestrator.saveSubMatchDraft(clubId, tournamentId, payload, commandOptions),
    patchTeamData,
    persistSetupTeamData,
    saveDraft,
    persistFormatVenueSetup,
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MATCH_STATUS } from "../constants/eventTypes.js";
import { REFEREE_V5_ERROR_VI } from "../persistence/errors.js";
import { resolveServeDirection } from "../selectors/serveContextSelector.js";
import { getRefereeV5EdgeBaseUrl, isRefereeV5RemoteMode } from "../flags.js";
import { createRemoteEdgeService } from "../services/refereeV5RemoteEdgeService.js";
import { RemotePersistenceAdapter } from "../adapters/RemotePersistenceAdapter.js";
import { REFEREE_V5_STAGING, REFEREE_V5_STAGING_FIXTURES } from "../prototype/refereeV5StagingFixtures.js";
import { useRefereeMatchController } from "./useRefereeMatchController.js";
import { useRefereeRealtimeSync } from "./useRefereeRealtimeSync.js";

function stagingFixture(id = "staging-doubles") {
  return REFEREE_V5_STAGING_FIXTURES.find((f) => f.id === id) || REFEREE_V5_STAGING_FIXTURES[0];
}

export function useRefereeRemoteMatchController({
  fixtureId = "staging-doubles",
  accessToken,
  tournamentId,
  matchId,
} = {}) {
  const fixture = stagingFixture(fixtureId);
  const adapterRef = useRef(null);
  const [state, setState] = useState(null);
  const [stateVersion, setStateVersion] = useState(0);
  const [lastEventSequence, setLastEventSequence] = useState(0);
  const [eventHistory, setEventHistory] = useState([]);
  const [lastError, setLastError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionMode, setConnectionMode] = useState("remote");
  const [loaded, setLoaded] = useState(false);

  const resolvedTenantId = REFEREE_V5_STAGING.TENANT_A;
  const resolvedTournamentId = tournamentId || fixture.tournamentId;
  const resolvedMatchId = matchId || fixture.matchId;
  const edgeBaseUrl = getRefereeV5EdgeBaseUrl();

  const applyReloadResult = useCallback((result) => {
    if (result.ok) {
      setState(result.state);
      setStateVersion(result.stateVersion);
      setLastEventSequence(result.lastEventSequence);
      setEventHistory(result.recentEvents || []);
      setLastError("");
      setConnectionMode("remote");
      setLoaded(true);
    } else {
      setLastError(REFEREE_V5_ERROR_VI[result.code] || result.error);
      setConnectionMode("remote-error");
    }
    return result;
  }, []);

  const reload = useCallback(async () => {
    if (!adapterRef.current) {
      return { ok: false };
    }
    const result = await adapterRef.current.reloadState();
    return applyReloadResult(result);
  }, [applyReloadResult]);

  const hasConflict = Boolean(lastError && lastError.includes("đồng bộ"));

  const realtime = useRefereeRealtimeSync({
    enabled: loaded && isRefereeV5RemoteMode() && Boolean(accessToken),
    tenantId: resolvedTenantId,
    tournamentId: resolvedTournamentId,
    matchId: resolvedMatchId,
    stateVersion,
    isProcessing,
    hasConflict,
    reloadOfficialState: reload,
  });

  useEffect(() => {
    if (!accessToken || !isRefereeV5RemoteMode()) {
      setLastError("Remote mode yêu cầu đăng nhập và VITE_REFEREE_V5_DATA_MODE=remote");
      return;
    }

    const service = createRemoteEdgeService(accessToken, edgeBaseUrl);
    adapterRef.current = new RemotePersistenceAdapter({
      service,
      tenantId: resolvedTenantId,
      tournamentId: resolvedTournamentId,
      matchId: resolvedMatchId,
      actor: { userId: "remote", role: "REFEREE" },
      assignment: { status: "active" },
    });

    adapterRef.current
      .loadMatch()
      .then((result) => {
        if (!result.ok) {
          setLastError(REFEREE_V5_ERROR_VI[result.code] || result.error || result.code);
          setConnectionMode("remote-error");
          return;
        }
        setState(result.state);
        setStateVersion(result.stateVersion);
        setLastEventSequence(result.lastEventSequence);
        setEventHistory(result.recentEvents || []);
        setLoaded(true);
        setConnectionMode("remote");
      })
      .catch((err) => {
        setLastError(String(err.message || err));
        setConnectionMode("remote-error");
      });
  }, [accessToken, edgeBaseUrl, resolvedMatchId, resolvedTournamentId, resolvedTenantId]);

  const dispatch = useCallback(
    async (commandType) => {
      if (!adapterRef.current || isProcessing) {
        return { ok: false };
      }
      setIsProcessing(true);
      setLastError("");

      const idem = `ui-${commandType}-${Date.now()}`;
      const result = await adapterRef.current.dispatchCommand({
        commandType,
        idempotencyKey: idem,
        clientMutationId: idem,
        expectedVersion: stateVersion,
        expectedSequence: lastEventSequence,
      });

      setIsProcessing(false);

      if (!result.ok) {
        const message = REFEREE_V5_ERROR_VI[result.code] || result.error || result.code;
        setLastError(
          result.code === "MATCH_STATE_CONFLICT"
            ? `${message} — hãy reload để đồng bộ.`
            : message,
        );
        return result;
      }

      if (result.state) {
        setState(result.state);
        setStateVersion(result.stateVersion ?? result.state.version);
        setLastEventSequence(result.lastEventSequence ?? result.state.lastEventSequence);
      } else {
        await reload();
      }

      return result;
    },
    [isProcessing, lastEventSequence, reload, stateVersion],
  );

  const canUndo = useMemo(
    () => state && state.status !== MATCH_STATUS.LOCKED && state.status !== MATCH_STATUS.COMPLETED,
    [state],
  );

  const isFinalized =
    state?.status === MATCH_STATUS.LOCKED || state?.status === MATCH_STATUS.COMPLETED;

  const actionsDisabled =
    isProcessing ||
    !loaded ||
    connectionMode === "remote-error" ||
    realtime.mutationsBlocked ||
    isFinalized;

  return {
    state: state || {},
    stateVersion,
    lastEventSequence,
    eventHistory,
    domainEventsBySequence: {},
    meta: { tournamentName: "Staging QA", matchCode: resolvedMatchId },
    fixtureId,
    lastError,
    isProcessing,
    timeoutActive: false,
    canUndo: canUndo && !isFinalized,
    actionsDisabled,
    connectionMode,
    realtimeConnectionState: realtime.connectionState,
    remoteUpdateNotice: realtime.remoteUpdateNotice,
    isRealtimeActive: realtime.isRealtimeActive,
    dispatch,
    loadFixture: () => reload(),
    resetFixture: () => reload(),
    reload,
    setLastError,
    serveDirection: state ? resolveServeDirection(state) : null,
  };
}

export function useRefereeMatchControllerWithMode(options = {}) {
  const remote = isRefereeV5RemoteMode() && options.accessToken;
  const local = useRefereeMatchController(options.initialFixtureId);
  const remoteCtrl = useRefereeRemoteMatchController({
    fixtureId: options.stagingFixtureId,
    accessToken: options.accessToken,
  });
  return remote ? remoteCtrl : local;
}

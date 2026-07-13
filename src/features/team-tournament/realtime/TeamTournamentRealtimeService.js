import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { buildMatchStateId } from "../../referee-v5/persistence/matchStateSerializer.js";
import { isTeamTournamentRealtimeEnabled } from "./realtimeFlags.js";
import {
  TT_REALTIME_CONNECTION,
  transitionConnectionState,
  isPollingEligibleState,
} from "./realtimeConnectionState.js";
import {
  validateRealtimeEventEnvelope,
  envelopeFromMatchupRow,
  envelopeFromSubMatchRow,
  envelopeFromBridgeRow,
} from "./realtimeEventEnvelope.js";
import {
  createRealtimeDeduplicator,
  computeReconnectBackoffMs,
  DEDUPE_OUTCOMES,
} from "./realtimeDeduplicator.js";
import { createPollingFallbackCoordinator } from "./realtimePollingFallback.js";
import { createRefereeV5RealtimeAdapter } from "./refereeV5RealtimeAdapter.js";
import {
  getTeamTournamentRealtimeObservability,
  createRealtimeObservability,
} from "./realtimeObservability.js";

let subscriptionCounter = 0;

function nextSubscriptionId() {
  subscriptionCounter += 1;
  return `tt-rt-sub-${subscriptionCounter}`;
}

function buildScopeKey(scopeType, parts) {
  return `${scopeType}:${parts.filter(Boolean).join(":")}`;
}

/**
 * @param {object} [deps]
 */
export function createTeamTournamentRealtimeService(deps = {}) {
  const getSupabase = deps.getSupabase ?? getSupabaseAuthClient;
  const observability = deps.observability ?? getTeamTournamentRealtimeObservability();
  const deduplicator = deps.deduplicator ?? createRealtimeDeduplicator();
  const polling = deps.polling ?? createPollingFallbackCoordinator();
  const enabled = deps.enabled ?? isTeamTournamentRealtimeEnabled();

  /** @type {Map<string, object>} */
  const subscriptions = new Map();
  /** @type {Set<(state: object) => void>} */
  const globalConnectionHandlers = new Set();

  function emitConnection(subscriptionId, state) {
    const sub = subscriptions.get(subscriptionId);
    if (sub) {
      sub.connectionState = state;
      sub.onConnectionStateChange?.(state, subscriptionId);
    }
    for (const handler of globalConnectionHandlers) {
      handler({ subscriptionId, state });
    }
  }

  function setSubscriptionState(sub, next) {
    const result = transitionConnectionState(sub.connectionState, next);
    if (!result.ok) {
      observability.log("invalid_connection_transition", {
        subscriptionId: sub.id,
        from: sub.connectionState,
        to: next,
      });
      return false;
    }
    sub.connectionState = next;
    emitConnection(sub.id, next);
    return true;
  }

  async function runSnapshotReload(sub, reason) {
    if (!sub.refreshSnapshot) {
      return { ok: false, error: "missing_refresh_handler" };
    }
    const started = Date.now();
    try {
      const result = await sub.refreshSnapshot({ reason, scope: sub.scope });
      if (result?.ok !== false) {
        observability.increment("snapshot_reload_success");
        if (result?.version != null) {
          sub.localVersion = Number(result.version);
        }
        observability.recordLatency(Date.now() - started);
        return { ok: true, result };
      }
      observability.increment("snapshot_reload_failure");
      return { ok: false, result };
    } catch (error) {
      observability.increment("snapshot_reload_failure");
      return { ok: false, error: error?.message || "snapshot_reload_failed" };
    }
  }

  async function handleEnvelope(sub, rawEnvelope) {
    const validated = validateRealtimeEventEnvelope(rawEnvelope);
    if (!validated.ok) {
      observability.log("invalid_envelope", {
        subscriptionId: sub.id,
        code: validated.code,
      });
      return;
    }
    const event = validated.event;
    const decision = deduplicator.evaluate(event, sub.localVersion ?? 0);

    switch (decision.outcome) {
      case DEDUPE_OUTCOMES.DUPLICATE_DISCARDED:
        observability.increment("duplicate_events");
        return;
      case DEDUPE_OUTCOMES.STALE_DISCARDED:
        observability.increment("stale_events");
        return;
      case DEDUPE_OUTCOMES.NO_OP:
        observability.increment("duplicate_events");
        return;
      case DEDUPE_OUTCOMES.PAYLOAD_CONFLICT:
        observability.increment("payload_conflicts");
        await runSnapshotReload(sub, decision.reason);
        return;
      case DEDUPE_OUTCOMES.ACCEPT:
      default:
        break;
    }

    sub.onEvent?.(event);
    if (decision.reload) {
      await runSnapshotReload(sub, decision.reason);
    }
  }

  function startPollingFallback(sub) {
    if (polling.isActive(sub.scopeKey)) {
      return;
    }
    observability.increment("fallback_polling_started");
    polling.start(sub.scopeKey, sub.scopeType, () => {
      runSnapshotReload(sub, "poll_fallback");
    });
    setSubscriptionState(sub, TT_REALTIME_CONNECTION.DEGRADED);
  }

  function stopPollingFallback(sub) {
    if (polling.isActive(sub.scopeKey)) {
      polling.stop(sub.scopeKey);
      observability.increment("fallback_polling_stopped");
    }
  }

  function attachPostgresChannel(sub) {
    const supabase = getSupabase();
    if (!supabase || !enabled) {
      startPollingFallback(sub);
      return;
    }

    setSubscriptionState(sub, TT_REALTIME_CONNECTION.CONNECTING);

    const channel = supabase.channel(sub.channelName);
    sub.channel = channel;
    sub.reconnectAttempt = 0;

    const registerHandler = (table, filter, mapper) => {
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table,
          filter,
        },
        (payload) => {
          const row = payload?.new ?? payload?.old;
          const envelope = mapper(row);
          if (envelope) {
            handleEnvelope(sub, envelope);
          }
        },
      );
    };

    if (sub.scopeType === "tournament") {
      registerHandler(
        "team_tournament_matchups",
        `tournament_id=eq.${sub.tournamentId}`,
        envelopeFromMatchupRow,
      );
    } else if (sub.scopeType === "matchup") {
      registerHandler(
        "team_tournament_matchups",
        `id=eq.${sub.matchupId}`,
        envelopeFromMatchupRow,
      );
    } else if (sub.scopeType === "sub_match") {
      registerHandler(
        "team_tournament_sub_matches",
        `id=eq.${sub.subMatchId}`,
        envelopeFromSubMatchRow,
      );
      registerHandler(
        "team_sub_match_referee_links",
        `sub_match_id=eq.${sub.subMatchId}`,
        envelopeFromBridgeRow,
      );
    }

    channel.subscribe((status) => {
      if (sub.disposed) {
        return;
      }
      if (status === "SUBSCRIBED") {
        sub.reconnectAttempt = 0;
        stopPollingFallback(sub);
        setSubscriptionState(sub, TT_REALTIME_CONNECTION.CONNECTED);
        runSnapshotReload(sub, "subscribe");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setSubscriptionState(sub, TT_REALTIME_CONNECTION.ERROR);
        startPollingFallback(sub);
        scheduleReconnect(sub);
      } else if (status === "CLOSED") {
        setSubscriptionState(sub, TT_REALTIME_CONNECTION.DISCONNECTED);
        startPollingFallback(sub);
        scheduleReconnect(sub);
      }
    });
  }

  function scheduleReconnect(sub) {
    if (sub.disposed || sub.reconnectTimer) {
      return;
    }
    sub.reconnectAttempt = (sub.reconnectAttempt ?? 0) + 1;
    observability.increment("reconnect_attempts");
    setSubscriptionState(sub, TT_REALTIME_CONNECTION.RECONNECTING);
    const delay = computeReconnectBackoffMs(sub.reconnectAttempt);
    sub.reconnectTimer = setTimeout(() => {
      sub.reconnectTimer = null;
      if (sub.disposed) {
        return;
      }
      teardownChannel(sub);
      attachPostgresChannel(sub);
    }, delay);
  }

  function teardownChannel(sub) {
    if (sub.reconnectTimer) {
      clearTimeout(sub.reconnectTimer);
      sub.reconnectTimer = null;
    }
    const supabase = getSupabase();
    if (supabase && sub.channel) {
      supabase.removeChannel(sub.channel);
      sub.channel = null;
    }
  }

  function createBaseSubscription(options) {
    const id = nextSubscriptionId();
    const sub = {
      id,
      ...options,
      connectionState: TT_REALTIME_CONNECTION.IDLE,
      localVersion: options.localVersion ?? 0,
      disposed: false,
      reconnectAttempt: 0,
      reconnectTimer: null,
      channel: null,
      adapter: null,
    };
    subscriptions.set(id, sub);
    observability.increment("subscriptions_started");
    return sub;
  }

  function subscribeInternal(options) {
    const sub = createBaseSubscription(options);

    if (!enabled || options.pollingOnly) {
      startPollingFallback(sub);
      setSubscriptionState(sub, TT_REALTIME_CONNECTION.DEGRADED);
      return { subscriptionId: sub.id, mode: "polling_only" };
    }

    if (!getSupabase()) {
      observability.increment("unauthorized_events");
      setSubscriptionState(sub, TT_REALTIME_CONNECTION.UNAUTHORIZED);
      return { subscriptionId: sub.id, mode: "unauthorized" };
    }

    attachPostgresChannel(sub);
    return { subscriptionId: sub.id, mode: "realtime" };
  }

  return {
    isEnabled: () => enabled,

    subscribeTournament(options) {
      const {
        tenantId,
        tournamentId,
        clubId,
        onEvent,
        onConnectionStateChange,
        refreshSnapshot,
        handlers = {},
        pollingOnly = false,
      } = options;
      const scopeKey = buildScopeKey("tournament", [tenantId, tournamentId]);
      return subscribeInternal({
        scopeType: "tournament",
        scopeKey,
        channelName: `tt:tournament:${tenantId}:${tournamentId}`,
        tenantId,
        tournamentId,
        clubId,
        pollingOnly,
        onEvent: onEvent ?? handlers.onTournamentChange,
        onConnectionStateChange,
        refreshSnapshot,
      });
    },

    subscribeMatchup(options) {
      const {
        tenantId,
        tournamentId,
        matchupId,
        onEvent,
        onConnectionStateChange,
        refreshSnapshot,
        handlers = {},
      } = options;
      const scopeKey = buildScopeKey("matchup", [tenantId, matchupId]);
      return subscribeInternal({
        scopeType: "matchup",
        scopeKey,
        channelName: `tt:matchup:${tenantId}:${matchupId}`,
        tenantId,
        tournamentId,
        matchupId,
        onEvent: onEvent ?? handlers.onMatchupChange,
        onConnectionStateChange,
        refreshSnapshot,
      });
    },

    subscribeSubMatch(options) {
      const {
        tenantId,
        tournamentId,
        subMatchId,
        onEvent,
        onConnectionStateChange,
        refreshSnapshot,
        handlers = {},
      } = options;
      const scopeKey = buildScopeKey("sub_match", [tenantId, subMatchId]);
      return subscribeInternal({
        scopeType: "sub_match",
        scopeKey,
        channelName: `tt:sub:${tenantId}:${subMatchId}`,
        tenantId,
        tournamentId,
        subMatchId,
        onEvent: onEvent ?? handlers.onMatchupChange,
        onConnectionStateChange,
        refreshSnapshot,
      });
    },

    subscribeRefereeMatch(options) {
      const {
        tenantId,
        tournamentId,
        externalSubMatchId,
        currentVersionRef,
        isProcessingRef,
        onEvent,
        onConnectionStateChange,
        refreshSnapshot,
      } = options;

      const scopeKey = buildScopeKey("referee_match", [tenantId, externalSubMatchId]);
      const sub = createBaseSubscription({
        scopeType: "referee_match",
        scopeKey,
        channelName: `referee-v5:match:${externalSubMatchId}`,
        tenantId,
        tournamentId,
        externalSubMatchId,
        onEvent,
        onConnectionStateChange,
        refreshSnapshot,
      });

      if (!enabled) {
        startPollingFallback(sub);
        setSubscriptionState(sub, TT_REALTIME_CONNECTION.DEGRADED);
        return { subscriptionId: sub.id, mode: "polling_only" };
      }

      const matchStateId = buildMatchStateId({
        tenantId,
        tournamentId,
        matchId: externalSubMatchId,
      });

      sub.adapter = createRefereeV5RealtimeAdapter({
        tenantId,
        tournamentId,
        externalSubMatchId,
        matchStateId,
        currentVersionRef: currentVersionRef ?? (() => sub.localVersion ?? 0),
        isProcessingRef: isProcessingRef ?? (() => false),
        observability,
        onConnectionChange: (state) => {
          setSubscriptionState(sub, state);
          if (isPollingEligibleState(state)) {
            startPollingFallback(sub);
          } else if (state === TT_REALTIME_CONNECTION.CONNECTED) {
            stopPollingFallback(sub);
          }
        },
        onEvent: (envelope) => handleEnvelope(sub, envelope),
        onReloadRequired: () => runSnapshotReload(sub, "referee_v5_reload"),
      });

      setSubscriptionState(sub, TT_REALTIME_CONNECTION.CONNECTING);
      return { subscriptionId: sub.id, mode: "referee_v5_adapter" };
    },

    unsubscribe(subscriptionId) {
      const sub = subscriptions.get(subscriptionId);
      if (!sub) {
        return false;
      }
      sub.disposed = true;
      teardownChannel(sub);
      stopPollingFallback(sub);
      sub.adapter?.dispose?.();
      subscriptions.delete(subscriptionId);
      observability.increment("subscriptions_closed");
      emitConnection(subscriptionId, TT_REALTIME_CONNECTION.CLOSED);
      return true;
    },

    unsubscribeAll() {
      for (const id of [...subscriptions.keys()]) {
        this.unsubscribe(id);
      }
      polling.dispose();
    },

    reconnect(subscriptionId) {
      const subs = subscriptionId
        ? [subscriptions.get(subscriptionId)].filter(Boolean)
        : [...subscriptions.values()];
      for (const sub of subs) {
        if (sub.adapter) {
          sub.adapter.reconnect();
        } else {
          teardownChannel(sub);
          attachPostgresChannel(sub);
        }
        runSnapshotReload(sub, "manual_reconnect");
      }
    },

    async refreshSnapshot(scope) {
      const matches = [...subscriptions.values()].filter((sub) => {
        if (!scope) {
          return true;
        }
        if (scope.subscriptionId) {
          return sub.id === scope.subscriptionId;
        }
        if (scope.tournamentId) {
          return sub.tournamentId === scope.tournamentId;
        }
        return false;
      });
      const results = [];
      for (const sub of matches) {
        results.push(await runSnapshotReload(sub, scope?.reason ?? "manual_refresh"));
      }
      return results;
    },

    getConnectionState(subscriptionId) {
      if (subscriptionId) {
        return subscriptions.get(subscriptionId)?.connectionState ?? TT_REALTIME_CONNECTION.IDLE;
      }
      const states = [...subscriptions.values()].map((s) => s.connectionState);
      if (states.some((s) => s === TT_REALTIME_CONNECTION.UNAUTHORIZED)) {
        return TT_REALTIME_CONNECTION.UNAUTHORIZED;
      }
      if (states.some((s) => isPollingEligibleState(s))) {
        return TT_REALTIME_CONNECTION.DEGRADED;
      }
      if (states.every((s) => s === TT_REALTIME_CONNECTION.CONNECTED || s === TT_REALTIME_CONNECTION.IDLE)) {
        return states.includes(TT_REALTIME_CONNECTION.CONNECTED)
          ? TT_REALTIME_CONNECTION.CONNECTED
          : TT_REALTIME_CONNECTION.IDLE;
      }
      return TT_REALTIME_CONNECTION.CONNECTING;
    },

    onConnectionStateChange(handler) {
      globalConnectionHandlers.add(handler);
      return () => globalConnectionHandlers.delete(handler);
    },

    getObservability: () => observability,
    __subscriptionsForTests: subscriptions,
  };
}

let sharedService = createTeamTournamentRealtimeService();

export function getTeamTournamentRealtimeService() {
  return sharedService;
}

/** @internal tests */
export function __resetTeamTournamentRealtimeServiceForTests(deps = {}) {
  sharedService.unsubscribeAll();
  sharedService = createTeamTournamentRealtimeService({
    observability: createRealtimeObservability(),
    ...deps,
  });
  return sharedService;
}

export { createTeamTournamentRealtimeService as TeamTournamentRealtimeServiceFactory };

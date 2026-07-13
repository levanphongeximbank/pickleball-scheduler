import { subscribeRefereeMatchRealtime } from "../../referee-v5/realtime/refereeV5RealtimeChannel.js";
import {
  mapRefereeV5ConnectionState,
  TT_REALTIME_CONNECTION,
  transitionConnectionState,
} from "./realtimeConnectionState.js";
import { envelopeFromRefereeV5Notification } from "./realtimeEventEnvelope.js";

/**
 * Wrap existing Referee V5 channel — no second subscription for same match.
 * @param {object} params
 */
export function createRefereeV5RealtimeAdapter(params) {
  const {
    tenantId,
    tournamentId,
    externalSubMatchId,
    matchStateId,
    currentVersionRef,
    isProcessingRef,
    onConnectionChange,
    onEvent,
    onReloadRequired,
    observability,
  } = params;

  let disposed = false;
  let unsubscribeV5 = () => {};
  let connectionState = TT_REALTIME_CONNECTION.IDLE;

  const setState = (next) => {
    const result = transitionConnectionState(connectionState, next);
    if (!result.ok) {
      observability?.log("invalid_connection_transition", {
        from: connectionState,
        to: next,
        scope: "referee_v5_adapter",
      });
      return;
    }
    connectionState = next;
    onConnectionChange?.(connectionState);
  };

  const attach = () => {
    if (disposed) {
      return;
    }
    setState(TT_REALTIME_CONNECTION.CONNECTING);
    unsubscribeV5 = subscribeRefereeMatchRealtime({
      matchStateId,
      matchId: externalSubMatchId,
      currentVersionRef,
      isProcessingRef,
      onConnectionChange: (refereeState) => {
        const mapped = mapRefereeV5ConnectionState(refereeState);
        setState(mapped);
      },
      onNotification: (note) => {
        const envelope = envelopeFromRefereeV5Notification(note, {
          tenantId,
          tournamentId,
          externalSubMatchId,
        });
        if (envelope) {
          onEvent?.(envelope);
        }
      },
      onReloadRequired: (detail) => {
        onReloadRequired?.(detail);
      },
    });
  };

  attach();

  return {
    getConnectionState: () => connectionState,
    reconnect() {
      if (disposed) {
        return;
      }
      observability?.increment("reconnect_attempts");
      unsubscribeV5();
      attach();
    },
    dispose() {
      disposed = true;
      unsubscribeV5();
      setState(TT_REALTIME_CONNECTION.CLOSED);
    },
  };
}

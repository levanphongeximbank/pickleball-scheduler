/**
 * TT-6B injectable metrics/logger — no external vendor.
 */

const defaultMetrics = {
  subscriptions_started: 0,
  subscriptions_closed: 0,
  reconnect_attempts: 0,
  fallback_polling_started: 0,
  fallback_polling_stopped: 0,
  duplicate_events: 0,
  stale_events: 0,
  payload_conflicts: 0,
  unauthorized_events: 0,
  snapshot_reload_success: 0,
  snapshot_reload_failure: 0,
  event_to_snapshot_latency_ms_total: 0,
  event_to_snapshot_latency_ms_count: 0,
};

/**
 * @param {Record<string, number>} [seed]
 */
export function createRealtimeObservability(seed = {}) {
  const metrics = { ...defaultMetrics, ...seed };
  /** @type {((entry: object) => void) | null} */
  let logger = null;

  return {
    metrics,
    setLogger(fn) {
      logger = typeof fn === "function" ? fn : null;
    },
    increment(key, amount = 1) {
      if (Object.prototype.hasOwnProperty.call(metrics, key)) {
        metrics[key] += amount;
      }
    },
    recordLatency(ms) {
      if (!Number.isFinite(ms) || ms < 0) {
        return;
      }
      metrics.event_to_snapshot_latency_ms_total += ms;
      metrics.event_to_snapshot_latency_ms_count += 1;
    },
    log(action, detail = {}) {
      if (!logger) {
        return;
      }
      const safe = { ...detail };
      delete safe.payload;
      delete safe.jwt;
      delete safe.token;
      logger({ component: "TeamTournamentRealtimeService", action, ...safe });
    },
    snapshot() {
      const avgLatency =
        metrics.event_to_snapshot_latency_ms_count > 0
          ? metrics.event_to_snapshot_latency_ms_total / metrics.event_to_snapshot_latency_ms_count
          : 0;
      return { ...metrics, event_to_snapshot_latency_ms_avg: avgLatency };
    },
    reset() {
      Object.keys(defaultMetrics).forEach((key) => {
        metrics[key] = 0;
      });
    },
  };
}

let sharedObservability = createRealtimeObservability();

export function getTeamTournamentRealtimeObservability() {
  return sharedObservability;
}

/** @internal tests */
export function __resetTeamTournamentRealtimeObservabilityForTests() {
  sharedObservability = createRealtimeObservability();
  return sharedObservability;
}

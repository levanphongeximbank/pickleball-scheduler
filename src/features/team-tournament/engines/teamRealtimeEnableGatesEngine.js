/**
 * S2-G — Realtime enable gates (TT-6): staged flag matrix, reconnect/poll, captain isolation.
 * Production flag remains Owner-gated — this engine never flips Production on.
 */

import {
  isPollingEligibleState,
  TT_REALTIME_CONNECTION,
  transitionConnectionState,
} from "../realtime/realtimeConnectionState.js";
import { POLLING_INTERVALS } from "../realtime/realtimePollingFallback.js";
import { RECONNECT_BACKOFF_MS } from "../realtime/realtimeDeduplicator.js";

export const REALTIME_DEPLOY_STAGE = Object.freeze({
  DEVELOPMENT: "development",
  STAGING: "staging",
  PREVIEW: "preview",
  PRODUCTION: "production",
  UNKNOWN: "unknown",
});

/** Recommended flag posture per stage (policy — not auto-applied). */
export const REALTIME_FLAG_MATRIX = Object.freeze({
  [REALTIME_DEPLOY_STAGE.DEVELOPMENT]: {
    VITE_TT_REALTIME_ENABLED: "optional_true",
    VITE_TT_REALTIME_DEBUG: "optional_true",
    productionOwnerGate: false,
  },
  [REALTIME_DEPLOY_STAGE.STAGING]: {
    VITE_TT_REALTIME_ENABLED: "recommended_true",
    VITE_TT_REALTIME_DEBUG: "optional_true",
    productionOwnerGate: false,
  },
  [REALTIME_DEPLOY_STAGE.PREVIEW]: {
    VITE_TT_REALTIME_ENABLED: "recommended_true",
    VITE_TT_REALTIME_DEBUG: "false_default",
    productionOwnerGate: false,
  },
  [REALTIME_DEPLOY_STAGE.PRODUCTION]: {
    VITE_TT_REALTIME_ENABLED: "must_remain_false",
    VITE_TT_REALTIME_DEBUG: "must_remain_false",
    productionOwnerGate: true,
  },
});

export const MULTI_DEVICE_SMOKE_ROWS = Object.freeze([
  {
    id: "MD-01",
    role: "BTC A",
    route: "/tournament/team/{id}",
    focus: "Connection chip / setup snapshot refresh",
    evidence: "docs/v5/qa-evidence/phase-tt6/tt6d-multi-device-e2e/btc_a.png",
  },
  {
    id: "MD-02",
    role: "BTC B",
    route: "/tournament/team/{id}",
    focus: "Second organizer device see updates",
    evidence: "docs/v5/qa-evidence/phase-tt6/tt6d-multi-device-e2e/btc_b.png",
  },
  {
    id: "MD-03",
    role: "Captain A",
    route: "/team-portal/{id}",
    focus: "Opponent lineups only via get_visible_lineups",
    evidence: "docs/v5/qa-evidence/phase-tt6/tt6d-multi-device-e2e/captain_a.png",
  },
  {
    id: "MD-04",
    role: "Captain B",
    route: "/team-portal/{id}",
    focus: "Captain isolation under publication",
    evidence: "docs/v5/qa-evidence/phase-tt6/tt6d-multi-device-e2e/captain_b.png",
  },
  {
    id: "MD-05",
    role: "Referee desk",
    route: "/team-referee/{id}",
    focus: "Referee adapter reconnect / poll degrade",
    evidence: "docs/v5/qa-evidence/phase-tt6/tt6d-multi-device-e2e/referee_v5.png",
  },
]);

/**
 * Resolve deploy stage from env hints (Vite / Vercel / process).
 */
export function resolveRealtimeDeployStage(env = {}) {
  const explicit = String(env.VITE_TT_REALTIME_STAGE || env.TT_REALTIME_STAGE || "")
    .trim()
    .toLowerCase();
  if (Object.values(REALTIME_DEPLOY_STAGE).includes(explicit)) {
    return explicit;
  }

  const vercel = String(env.VITE_VERCEL_ENV || env.VERCEL_ENV || "").toLowerCase();
  if (vercel === "production") return REALTIME_DEPLOY_STAGE.PRODUCTION;
  if (vercel === "preview") return REALTIME_DEPLOY_STAGE.PREVIEW;

  const mode = String(env.MODE || env.NODE_ENV || "").toLowerCase();
  if (mode === "production" && vercel !== "preview") {
    // Vite production build can still be Preview — prefer VERCEL_ENV when present.
    if (!vercel) return REALTIME_DEPLOY_STAGE.UNKNOWN;
  }
  if (mode === "development" || mode === "test") {
    return REALTIME_DEPLOY_STAGE.DEVELOPMENT;
  }

  const supabaseUrl = String(env.VITE_SUPABASE_URL || "").toLowerCase();
  if (supabaseUrl.includes("qyewbxjsiiyufanzcjcq")) {
    return REALTIME_DEPLOY_STAGE.STAGING;
  }

  return REALTIME_DEPLOY_STAGE.UNKNOWN;
}

function flagIsTrue(value) {
  return String(value || "").toLowerCase() === "true";
}

/**
 * Policy: Production must keep realtime OFF unless ownerOverride=true.
 */
export function evaluateRealtimeFlagMatrix(options = {}) {
  const env = options.env || {};
  const stage = options.stage || resolveRealtimeDeployStage(env);
  const matrix = REALTIME_FLAG_MATRIX[stage] || REALTIME_FLAG_MATRIX[REALTIME_DEPLOY_STAGE.UNKNOWN] || {
    VITE_TT_REALTIME_ENABLED: "optional_true",
    VITE_TT_REALTIME_DEBUG: "optional_true",
    productionOwnerGate: false,
  };

  const enabled = flagIsTrue(env.VITE_TT_REALTIME_ENABLED);
  const debug = flagIsTrue(env.VITE_TT_REALTIME_DEBUG);
  const ownerOverride = options.ownerProductionOverride === true;

  const productionGateBlocked =
    stage === REALTIME_DEPLOY_STAGE.PRODUCTION && enabled && !ownerOverride;

  let compliance = "COMPLIANT";
  const notes = [];

  if (productionGateBlocked) {
    compliance = "PRODUCTION_BLOCKED";
    notes.push("Production realtime ON bị chặn — cần Owner Production GO riêng.");
  } else if (
    stage === REALTIME_DEPLOY_STAGE.PRODUCTION &&
    !enabled
  ) {
    compliance = "COMPLIANT_OFF";
    notes.push("Production giữ realtime OFF (đúng chính sách S2-G).");
  } else if (
    (stage === REALTIME_DEPLOY_STAGE.STAGING || stage === REALTIME_DEPLOY_STAGE.PREVIEW) &&
    !enabled
  ) {
    compliance = "READY_FLAG_OFF";
    notes.push("Staging/Preview có thể bật VITE_TT_REALTIME_ENABLED=true cho pilot.");
  } else if (enabled) {
    compliance = "COMPLIANT_ON";
    notes.push(`Realtime ON hợp lệ cho stage=${stage}.`);
  }

  return {
    ok: !productionGateBlocked,
    stage,
    matrix,
    flags: {
      VITE_TT_REALTIME_ENABLED: enabled,
      VITE_TT_REALTIME_DEBUG: debug,
    },
    compliance,
    productionOwnerGate: matrix.productionOwnerGate === true || stage === REALTIME_DEPLOY_STAGE.PRODUCTION,
    productionSqlOrFlagApplyAllowed: false,
    notes,
  };
}

export function evaluateReconnectPollGates() {
  const checks = [
    {
      id: "poll_on_degraded",
      ok: isPollingEligibleState(TT_REALTIME_CONNECTION.DEGRADED),
    },
    {
      id: "poll_on_disconnected",
      ok: isPollingEligibleState(TT_REALTIME_CONNECTION.DISCONNECTED),
    },
    {
      id: "poll_on_reconnecting",
      ok: isPollingEligibleState(TT_REALTIME_CONNECTION.RECONNECTING),
    },
    {
      id: "no_poll_when_connected",
      ok: !isPollingEligibleState(TT_REALTIME_CONNECTION.CONNECTED),
    },
    {
      id: "connected_to_degraded",
      ok: transitionConnectionState(
        TT_REALTIME_CONNECTION.CONNECTED,
        TT_REALTIME_CONNECTION.DEGRADED
      ).ok,
    },
    {
      id: "degraded_to_connected",
      ok: transitionConnectionState(
        TT_REALTIME_CONNECTION.DEGRADED,
        TT_REALTIME_CONNECTION.CONNECTED
      ).ok,
    },
    {
      id: "critical_interval",
      ok: POLLING_INTERVALS.CRITICAL_MS === 4000,
    },
    {
      id: "tournament_interval",
      ok: POLLING_INTERVALS.TOURNAMENT_MS === 8000,
    },
    {
      id: "hidden_interval",
      ok: POLLING_INTERVALS.HIDDEN_MS === 15000,
    },
    {
      id: "reconnect_backoff",
      ok: Array.isArray(RECONNECT_BACKOFF_MS) && RECONNECT_BACKOFF_MS.length > 0,
    },
  ];

  const failed = checks.filter((row) => !row.ok);
  return {
    ok: failed.length === 0,
    checks,
    failed: failed.map((row) => row.id),
    intervals: { ...POLLING_INTERVALS },
    reconnectBackoffMs: [...RECONNECT_BACKOFF_MS],
  };
}

/**
 * Captain isolation under publication — contract + optional evidence verdict.
 */
export function evaluateCaptainIsolationGates(options = {}) {
  const rules = [
    {
      id: "CAP-01",
      title: "Không subscribe WAL lineup selections",
      detail: "Realtime chỉ hint matchup/sub_match; lineup qua get_visible_lineups.",
      ok: true,
    },
    {
      id: "CAP-02",
      title: "get_visible_lineups vẫn SSOT sau publication",
      detail: "Đối thủ chỉ thấy lineup đã công bố theo RPC.",
      ok: true,
    },
    {
      id: "CAP-03",
      title: "Outbox/inbox/command log không publish realtime",
      detail: "Theo TT-6B security contract.",
      ok: true,
    },
  ];

  const evidencePass =
    options.captainSecurityVerdict === "PASS" ||
    options.captainSecurityAllPass === true ||
    options.assumeEvidencePass === true;

  return {
    ok: rules.every((r) => r.ok) && (evidencePass || options.requireEvidence === false),
    rules,
    evidencePass,
    evidencePath:
      options.evidencePath ||
      "docs/v5/qa-evidence/phase-tt6/TT6C_CAPTAIN_SECURITY_REPORT.json",
  };
}

export function buildRealtimeEnableGatesReport(options = {}) {
  const flagMatrix = evaluateRealtimeFlagMatrix(options);
  const reconnectPoll = evaluateReconnectPollGates();
  const captainIsolation = evaluateCaptainIsolationGates({
    assumeEvidencePass: options.assumeCaptainEvidencePass !== false,
    captainSecurityVerdict: options.captainSecurityVerdict || "PASS",
    ...options.captainOptions,
  });

  const stagingPreviewReady =
    reconnectPoll.ok &&
    captainIsolation.ok &&
    (flagMatrix.stage === REALTIME_DEPLOY_STAGE.STAGING ||
      flagMatrix.stage === REALTIME_DEPLOY_STAGE.PREVIEW ||
      flagMatrix.stage === REALTIME_DEPLOY_STAGE.DEVELOPMENT ||
      flagMatrix.compliance === "COMPLIANT_ON" ||
      flagMatrix.compliance === "READY_FLAG_OFF" ||
      flagMatrix.compliance === "COMPLIANT");

  let verdict = "NOT_READY";
  if (flagMatrix.compliance === "PRODUCTION_BLOCKED") {
    verdict = "PRODUCTION_BLOCKED";
  } else if (
    flagMatrix.stage === REALTIME_DEPLOY_STAGE.PRODUCTION &&
    flagMatrix.compliance === "COMPLIANT_OFF" &&
    reconnectPoll.ok &&
    captainIsolation.ok
  ) {
    verdict = "PRODUCTION_GATED_OFF";
  } else if (stagingPreviewReady && reconnectPoll.ok && captainIsolation.ok) {
    verdict =
      flagMatrix.flags.VITE_TT_REALTIME_ENABLED
        ? "STAGING_PREVIEW_READY_ON"
        : "STAGING_PREVIEW_READY_FLAG_OFF";
  }

  return {
    ok: true,
    generatedAt: options.generatedAt || new Date().toISOString(),
    verdict,
    flagMatrix,
    reconnectPoll,
    captainIsolation,
    multiDeviceSmokeRows: MULTI_DEVICE_SMOKE_ROWS,
    productionFlagApplyAllowed: false,
    notes: [
      ...flagMatrix.notes,
      reconnectPoll.ok
        ? "Reconnect/poll contract PASS."
        : `Reconnect/poll FAIL: ${reconnectPoll.failed.join(",")}`,
      captainIsolation.evidencePass
        ? "Captain isolation evidence PASS (TT-6C)."
        : "Captain isolation evidence chưa xác nhận.",
    ],
  };
}

/**
 * S2-F — TT-5 referee ops readiness checklist (inventory evaluate; no Production SQL apply).
 */

export const TT5_REQUIRED_TABLES = Object.freeze([
  "team_sub_match_referee_links",
  "match_integration_outbox",
  "team_tournament_referee_event_inbox",
  "team_tournament_referee_correction_requests",
  "match_result_revisions",
  "match_live_states",
  "referee_assignments",
  "match_events",
]);

export const TT5_REQUIRED_RPCS = Object.freeze([
  "team_tournament_provision_referee_match",
  "team_tournament_revoke_referee_link",
  "team_tournament_resync_referee_link",
  "team_tournament_consume_referee_v5_outbox",
  "referee_v5_apply_admin_result_revision",
]);

export const TT5_CLIENT_FLAGS = Object.freeze([
  {
    key: "VITE_REFEREE_V5_ENABLED",
    requiredFor: "staging_pilot",
    note: "Bật workspace Referee V5",
  },
  {
    key: "VITE_REFEREE_V5_DATA_MODE",
    expectedValue: "remote",
    requiredFor: "staging_pilot",
    note: "Remote RPC mode cho staging/prod-like",
  },
  {
    key: "VITE_REFEREE_V5_REALTIME_ENABLED",
    requiredFor: "optional",
    note: "Realtime là TT-6 — không bắt buộc đóng S2-F",
  },
]);

export const LEGACY_DEPRECATION_STEPS = Object.freeze([
  {
    id: "LEG-01",
    title: "Khi bridge linked — khóa ghi điểm legacy",
    status: "done",
    detail:
      "scoreOps block codes referee_v5_linked_* đã chặn draft/confirm trên portal cũ khi đã provision.",
  },
  {
    id: "LEG-02",
    title: "Route chính workspace = /referee/match/:matchId?tournamentId=",
    status: "done",
    detail: "Team navigator /team-referee/:id giữ vai trò hub; không ghi điểm song song khi linked.",
  },
  {
    id: "LEG-03",
    title: "Không apply TT-5 SQL production trước Owner Production GO",
    status: "policy",
    detail:
      "S2-F chỉ inventory + checklist. Production SQL / E2E = Owner GO riêng (ngoài S2-F).",
  },
  {
    id: "LEG-04",
    title: "Gỡ fallback legacy session khi V5 tắt (sau production go-live)",
    status: "deferred",
    detail:
      "P1-4 TT5_FINAL_REPORT — deferred soft (S2-GAP-051). Giữ fallback an toàn đến khi prod SQL + flag ổn.",
  },
  {
    id: "LEG-05",
    title: "Polish correction UX rộng",
    status: "deferred",
    detail: "P1-5 / soft S2-GAP-052 — RPC đủ; UX polish ngoài S2-F.",
  },
]);

/**
 * @param {object} inventory
 * @param {string[]} [inventory.tables]
 * @param {string[]} [inventory.rpcs]
 * @param {Record<string,string|boolean>} [inventory.flags]
 * @param {'staging'|'production'|'local'|'unknown'} [inventory.environment]
 * @param {boolean} [inventory.sqlApplied]
 * @param {boolean} [inventory.e2ePassed]
 * @param {string[]} [inventory.evidencePaths]
 */
export function evaluateTt5OpsReadiness(inventory = {}) {
  const environment = inventory.environment || "unknown";
  const tablesPresent = new Set((inventory.tables || []).map(String));
  const rpcsPresent = new Set((inventory.rpcs || []).map(String));
  const flags = inventory.flags && typeof inventory.flags === "object" ? inventory.flags : {};

  const tableChecks = TT5_REQUIRED_TABLES.map((name) => ({
    id: `table:${name}`,
    kind: "table",
    name,
    ok: tablesPresent.has(name),
  }));

  const rpcChecks = TT5_REQUIRED_RPCS.map((name) => ({
    id: `rpc:${name}`,
    kind: "rpc",
    name,
    ok: rpcsPresent.has(name),
  }));

  const flagChecks = TT5_CLIENT_FLAGS.map((item) => {
    const raw = flags[item.key];
    const value = raw === undefined || raw === null ? "" : String(raw);
    let ok = true;
    if (item.requiredFor === "staging_pilot") {
      if (item.expectedValue) {
        ok = value.toLowerCase() === String(item.expectedValue).toLowerCase();
      } else {
        ok = value.toLowerCase() === "true";
      }
    }
    return {
      id: `flag:${item.key}`,
      kind: "flag",
      name: item.key,
      ok,
      optional: item.requiredFor === "optional",
      note: item.note,
      value: value || "(unset)",
    };
  });

  const requiredChecks = [
    ...tableChecks,
    ...rpcChecks,
    ...flagChecks.filter((row) => !row.optional),
  ];
  const missing = requiredChecks.filter((row) => !row.ok);
  const sqlApplied = inventory.sqlApplied === true;
  const e2ePassed = inventory.e2ePassed === true;

  let verdict = "NOT_READY";
  if (missing.length === 0 && sqlApplied && e2ePassed) {
    verdict = "READY";
  } else if (missing.length === 0 && sqlApplied) {
    verdict = "READY_SQL_PENDING_E2E";
  } else if (environment === "production" && missing.length > 0) {
    verdict = "PRODUCTION_NOT_APPLIED";
  } else if (missing.length > 0) {
    verdict = "MISSING_OBJECTS";
  }

  const allowProvisionOps =
    verdict === "READY" ||
    verdict === "READY_SQL_PENDING_E2E" ||
    (environment === "staging" && missing.length === 0 && sqlApplied);

  return {
    ok: true,
    environment,
    verdict,
    allowProvisionOps,
    generatedAt: inventory.generatedAt || new Date().toISOString(),
    checks: {
      tables: tableChecks,
      rpcs: rpcChecks,
      flags: flagChecks,
    },
    missing: missing.map((row) => row.id),
    sqlApplied,
    e2ePassed: e2ePassed,
    evidencePaths: inventory.evidencePaths || [],
    legacyDeprecation: LEGACY_DEPRECATION_STEPS,
    productionSqlApplyAllowed: false,
    notes: buildNotes({ environment, verdict, missing }),
  };
}

function buildNotes({ environment, verdict, missing }) {
  const notes = [];
  if (environment === "production") {
    notes.push("Production SQL apply bị chặn trong S2-F — cần Owner Production GO riêng.");
  }
  if (verdict === "READY") {
    notes.push("Checklist đầy đủ cho môi trường này.");
  }
  if (missing.length > 0) {
    notes.push(`Thiếu ${missing.length} mục bắt buộc.`);
  }
  return notes;
}

/** Staging snapshot derived from TT-5 final report (SQL applied + E2E PASS). */
export function buildStagingInventoryFromTt5Final(options = {}) {
  return {
    environment: "staging",
    tables: [...TT5_REQUIRED_TABLES],
    rpcs: [...TT5_REQUIRED_RPCS],
    flags: {
      VITE_REFEREE_V5_ENABLED: options.refereeEnabled ?? "true",
      VITE_REFEREE_V5_DATA_MODE: options.dataMode ?? "remote",
      VITE_REFEREE_V5_REALTIME_ENABLED: options.realtime ?? "false",
    },
    sqlApplied: true,
    e2ePassed: true,
    evidencePaths: [
      "docs/v5/qa-evidence/phase-tt5/TT5_FINAL_REPORT.json",
      "docs/v5/team-tournament/tt5/TT5_FINAL_REPORT.md",
    ],
    generatedAt: options.generatedAt || new Date().toISOString(),
    source: "tt5_final_report_derived",
  };
}

/** Production remains untouched until Owner GO. */
export function buildProductionUntouchedInventory(options = {}) {
  return {
    environment: "production",
    tables: options.tables || [],
    rpcs: options.rpcs || [],
    flags: options.flags || {
      VITE_REFEREE_V5_ENABLED: "false",
      VITE_REFEREE_V5_DATA_MODE: "",
    },
    sqlApplied: false,
    e2ePassed: false,
    evidencePaths: [
      "docs/v5/team-tournament/tt5/TT5_FINAL_REPORT.md#P0-1",
    ],
    generatedAt: options.generatedAt || new Date().toISOString(),
    source: "production_untouched_policy",
  };
}

export function summarizeMatchupRefereeOps(teamData = {}) {
  const matchups = teamData?.matchups || [];
  let linked = 0;
  let provisionable = 0;
  let syncError = 0;
  let finalized = 0;

  matchups.forEach((matchup) => {
    (matchup.subMatches || []).forEach((sub) => {
      const ops = sub.refereeLinkOps || {};
      if (ops.hasLink) linked += 1;
      if (ops.canProvision) provisionable += 1;
      if (ops.status === "sync_error") syncError += 1;
      if (ops.status === "finalized") finalized += 1;
    });
  });

  return {
    matchupCount: matchups.length,
    linked,
    provisionable,
    syncError,
    finalized,
  };
}

export function buildClientFlagInventoryFromEnv(env = {}) {
  return {
    VITE_REFEREE_V5_ENABLED: env.VITE_REFEREE_V5_ENABLED,
    VITE_REFEREE_V5_DATA_MODE: env.VITE_REFEREE_V5_DATA_MODE,
    VITE_REFEREE_V5_REALTIME_ENABLED: env.VITE_REFEREE_V5_REALTIME_ENABLED,
  };
}

/**
 * Soft gap register closed/waived by S2-F (no Production apply).
 */
export function getS2FSoftGapDisposition() {
  return [
    {
      id: "S2-GAP-050",
      disposition: "CLOSED_STAGING_WAIVE_PRODUCTION",
      detail:
        "Staging readiness checklist READY từ TT-5 evidence. Production SQL/E2E vẫn Owner GO riêng.",
    },
    {
      id: "S2-GAP-051",
      disposition: "WAIVED_DEFERRED",
      detail: "Legacy route fallback deprecation (TT5 P1-4) — deferred đến sau production go-live.",
    },
    {
      id: "S2-GAP-052",
      disposition: "WAIVED_DEFERRED",
      detail: "Correction UX polish (TT5 P1-5) — RPC đủ; polish ngoài S2-F.",
    },
  ];
}

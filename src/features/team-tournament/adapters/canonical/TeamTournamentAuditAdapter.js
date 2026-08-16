/**
 * Team Tournament Adapter ĐẦU B — Audit.
 * Preserves Team domain audit history and bridges to the canonical audit contract.
 * Does not import Team audit persistence at module load (no identity/supabase pull).
 */

import {
  AUDIT_CONTRACT,
  createAuditBinding,
  createNotConfiguredContractAdapter,
} from "../../../competition-engine/integration/contracts/index.js";
import { TEAM_ADAPTER_B_CLASSIFICATION, TEAM_ADAPTER_B_NAMES } from "./constants.js";
import { wrapTeamBAdapter } from "./surface.js";

export function createTeamTournamentAuditSink(deps = {}) {
  const preserveLocal =
    typeof deps.preserveLocal === "function" ? deps.preserveLocal : null;
  const appendCanonical =
    typeof deps.appendCanonical === "function" ? deps.appendCanonical : null;
  const queryCanonical =
    typeof deps.queryCanonical === "function" ? deps.queryCanonical : null;
  const queryLocal = typeof deps.queryLocal === "function" ? deps.queryLocal : null;

  return {
    async append(record = {}) {
      if (preserveLocal) {
        preserveLocal({
          action: record.action,
          targetId: record.entityRef || record.competitionId || record.targetId,
          metadata: record.metadata || record,
          actorUserId: record.actorId || null,
        });
      }
      if (!appendCanonical) {
        return { ok: false, notConfigured: true, preservedLocal: Boolean(preserveLocal) };
      }
      return appendCanonical(record);
    },
    async query(record = {}) {
      const local = queryLocal ? queryLocal(record.limit || 100) : [];
      if (!queryCanonical) {
        return { ok: true, records: local, sharedRuntime: "NOT_CONFIGURED" };
      }
      return queryCanonical(record);
    },
  };
}

export function createTeamTournamentAuditAdapter(deps = {}) {
  const sink = deps.sink || createTeamTournamentAuditSink(deps);
  const hasCanonicalAppend =
    typeof deps.append === "function" || typeof deps.appendCanonical === "function";
  const inner =
    deps.contractA ||
    (hasCanonicalAppend
      ? createAuditBinding({
          ...deps,
          append: deps.append || sink.append,
          query: deps.query || sink.query,
        })
      : createNotConfiguredContractAdapter(AUDIT_CONTRACT));

  return wrapTeamBAdapter(inner, {
    adapterBName: TEAM_ADAPTER_B_NAMES[16],
    ordinal: 16,
    classification: TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED,
    activation: true,
    requiredMethods: AUDIT_CONTRACT.requiredMethods,
    sharedRuntime: inner.productionBinding,
  });
}

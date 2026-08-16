/**
 * Owner Team Tournament pairing — opaque server runtime.
 *
 * Client generates MLP candidates without private-rule payloads.
 * Server loads applicable rules internally and returns only a sanitized formation.
 * Never calls the Super Admin private-rule read RPC.
 * Never falls back to empty rules on PERMISSION_DENIED.
 */

import { generateMlpTeamFormationCandidatePool } from "../engines/teamAutoDrawEngine.js";
import {
  isTeamTournamentRpcNotFoundError,
  rpcTeamTournamentFormPairingOpaque,
} from "./teamTournamentRpcService.js";
import { FORMAT_PRESET } from "../constants.js";

export const OPAQUE_TEAM_FORMATION_ALGORITHM = "tt-opaque-formation-v1";

export const OPAQUE_PAIRING_GENERIC_CODES = Object.freeze([
  "PAIRING_RULE_CONSTRAINT_UNSATISFIED",
  "NO_FEASIBLE_PAIRING",
  "PAIRING_SEARCH_LIMIT_REACHED",
]);

const GENERIC_OWNER_MESSAGES = Object.freeze({
  PAIRING_RULE_CONSTRAINT_UNSATISFIED:
    "Không thể ghép đội vì ràng buộc ghép cặp không thỏa.",
  NO_FEASIBLE_PAIRING: "Không tìm được phương án ghép đội hợp lệ.",
  PAIRING_SEARCH_LIMIT_REACHED:
    "Đã đạt giới hạn tìm kiếm ghép đội — không có phương án hợp lệ.",
});

function genericOwnerError(code, fallbackMessage) {
  const normalized = String(code || "").trim();
  const message =
    GENERIC_OWNER_MESSAGES[normalized] ||
    fallbackMessage ||
    GENERIC_OWNER_MESSAGES.NO_FEASIBLE_PAIRING;
  return {
    ok: false,
    code: OPAQUE_PAIRING_GENERIC_CODES.includes(normalized)
      ? normalized
      : normalized || "NO_FEASIBLE_PAIRING",
    message,
    privatePairingError: { ok: false, code: normalized || "NO_FEASIBLE_PAIRING", message },
  };
}

function stripSecretFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripSecretFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const blocked = new Set([
    "reason_text",
    "reasonText",
    "target_player_ids",
    "targetPlayerIds",
    "primary_player_id",
    "primaryPlayerId",
    "weight",
    "visibility",
    "reason_category",
    "reasonCategory",
    "privatePairingRules",
    "rules",
    "ruleSet",
  ]);
  const next = {};
  Object.entries(value).forEach(([key, item]) => {
    if (blocked.has(key)) return;
    next[key] = stripSecretFields(item);
  });
  return next;
}

export function mapOpaquePairingFailure(result = {}) {
  const code = String(result.code || "").trim();
  if (
    code === "RPC_MISSING" ||
    code === "rpc_not_deployed" ||
    code === "RPC_NOT_DEPLOYED" ||
    code === "NO_SUPABASE"
  ) {
    return {
      ok: false,
      code: "RPC_MISSING",
      message: "Ghép đội chưa sẵn sàng trên máy chủ — không bỏ qua quy tắc riêng.",
      privatePairingError: {
        ok: false,
        code: "RPC_MISSING",
        message: "Ghép đội chưa sẵn sàng trên máy chủ — không bỏ qua quy tắc riêng.",
      },
    };
  }
  return genericOwnerError(code, result.error || result.message);
}

export async function formTeamTournamentPairingOpaque({
  tournamentId,
  players = [],
  selectedPlayerIds = [],
  teamCount,
  teamNames = [],
  formatPreset = FORMAT_PRESET.MLP_4,
  competitionClass = "INTERNAL",
  clubId = null,
  seed,
  randomFn,
  requireFullFill = true,
  allowedByPublishedRules = false,
  requestId = null,
  formPairing = rpcTeamTournamentFormPairingOpaque,
} = {}) {
  const id = String(tournamentId || "").trim();
  if (!id) {
    return genericOwnerError("VALIDATION", "Thiếu mã giải để ghép đội.");
  }

  const generated = generateMlpTeamFormationCandidatePool({
    players,
    selectedPlayerIds,
    teamCount,
    teamNames,
    formatPreset,
    randomFn,
    seed,
    maxCandidates: 24,
    requireFullFill,
  });
  if (!generated.ok) {
    return {
      ok: false,
      code: "NO_FEASIBLE_PAIRING",
      message: generated.warnings?.[0] || "Không tạo được phương án ghép đội.",
      warnings: generated.warnings || [],
      privatePairingError: {
        ok: false,
        code: "NO_FEASIBLE_PAIRING",
        message: generated.warnings?.[0] || "Không tạo được phương án ghép đội.",
      },
    };
  }

  const rpcResult = await formPairing({
    tournamentId: id,
    candidates: generated.candidates.map((candidate) => ({
      id: candidate.id,
      teams: candidate.teams,
      waitingPlayerIds: candidate.waitingPlayerIds,
      warnings: candidate.warnings,
      formationQuality: candidate.formationQuality,
    })),
    competitionClass,
    clubId,
    seed: seed == null ? null : String(seed),
    requestId,
    allowedByPublishedRules,
  });

  if (
    isTeamTournamentRpcNotFoundError(rpcResult) ||
    rpcResult?.code === "RPC_MISSING" ||
    rpcResult?.code === "rpc_not_deployed" ||
    rpcResult?.code === "NO_SUPABASE"
  ) {
    return mapOpaquePairingFailure({ code: "RPC_MISSING" });
  }

  if (!rpcResult?.ok) {
    return mapOpaquePairingFailure(rpcResult);
  }

  const teams = Array.isArray(rpcResult.teams) ? rpcResult.teams : [];
  if (!teams.length) {
    return genericOwnerError("NO_FEASIBLE_PAIRING");
  }

  return {
    ok: true,
    teams,
    waitingPlayerIds: Array.isArray(rpcResult.waitingPlayerIds)
      ? rpcResult.waitingPlayerIds
      : [],
    warnings: Array.isArray(rpcResult.warnings) ? rpcResult.warnings : [],
    privatePairingError: null,
    randomSeed: rpcResult.randomSeed || seed || null,
    rulesVersion: String(rpcResult.ruleSetVersion || ""),
    algorithmVersion: rpcResult.algorithmVersion || OPAQUE_TEAM_FORMATION_ALGORITHM,
    constraintScore: rpcResult.constraintScore,
    privatePairingMeta: stripSecretFields({
      runtimeEnabled: true,
      formationRulesApplied: rpcResult.enforced === true ? 1 : 0,
      candidateCount: rpcResult.candidateCount,
      rejectedCandidateCount: rpcResult.rejectedCandidateCount,
      ruleSetVersion: rpcResult.ruleSetVersion || "",
      algorithmVersion: rpcResult.algorithmVersion || OPAQUE_TEAM_FORMATION_ALGORITHM,
      requestId: rpcResult.requestId || requestId || null,
      enforced: rpcResult.enforced === true,
    }),
  };
}

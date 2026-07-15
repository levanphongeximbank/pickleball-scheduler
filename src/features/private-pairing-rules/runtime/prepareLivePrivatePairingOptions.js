import { COMPETITION_CLASS, RESTRICTED_COMPETITION_CLASSES } from "../constants/enums.js";
import { PRIVATE_PAIRING_SCOPE } from "../constants/scopes.js";
import { loadActivePrivatePairingRulesForRuntime } from "../services/privatePairingRulesService.js";
import { resolveActivePrivatePairingRules } from "./resolveActiveRules.js";
import {
  PRIVATE_PAIRING_RUNTIME_CODE,
  isPrivatePairingRuntimeEnabled,
} from "./runtimeCodes.js";

function isRestrictedCompetitionClass(competitionClass) {
  return RESTRICTED_COMPETITION_CLASSES.has(String(competitionClass || "").toUpperCase());
}

/**
 * Load active private pairing rules for live pairing by scope.
 * - Tournament present → tournament scope first (never another tournament).
 * - Official/certified → no club fallback.
 * - Internal → club fallback only when tournament rule set is empty.
 * - No tournamentId → club scope (Daily Play / club activity).
 * Load failures are not silently ignored.
 *
 * @param {Object} input
 * @returns {Promise<{ok:boolean, rules?:Array, ruleSet?:unknown, scopeType?:string|null, usedClubFallback?:boolean, skipped?:boolean, code?:string, message?:string, details?:unknown}>}
 */
export async function loadActiveRulesForLiveScope(input = {}) {
  const {
    clubId = null,
    tournamentId = null,
    tenantId = null,
    competitionClass = COMPETITION_CLASS.INTERNAL,
    envSource,
  } = input;

  if (!isPrivatePairingRuntimeEnabled(envSource)) {
    return { ok: true, skipped: true, rules: [], ruleSet: null, scopeType: null };
  }

  const restricted = isRestrictedCompetitionClass(competitionClass);

  if (tournamentId) {
    const tournamentLoad = await loadActivePrivatePairingRulesForRuntime(
      {
        scopeType: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
        scopeId: String(tournamentId),
        tenantId,
      },
      envSource
    );

    if (!tournamentLoad.ok && !tournamentLoad.skipped) {
      return {
        ok: false,
        code: tournamentLoad.code || "PRIVATE_PAIRING_LOAD_FAILED",
        message: tournamentLoad.message || "Không tải được bộ quy tắc theo scope giải đấu.",
        details: tournamentLoad,
        rules: [],
        ruleSet: null,
        scopeType: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
      };
    }

    if ((tournamentLoad.rules || []).length > 0) {
      return {
        ok: true,
        rules: tournamentLoad.rules,
        ruleSet: tournamentLoad.ruleSet || null,
        scopeType: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
        usedClubFallback: false,
      };
    }

    if (restricted) {
      return {
        ok: true,
        rules: [],
        ruleSet: tournamentLoad.ruleSet || null,
        scopeType: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
        usedClubFallback: false,
      };
    }

    if (clubId) {
      const clubLoad = await loadActivePrivatePairingRulesForRuntime(
        {
          scopeType: PRIVATE_PAIRING_SCOPE.CLUB,
          scopeId: String(clubId),
          tenantId,
        },
        envSource
      );

      if (!clubLoad.ok && !clubLoad.skipped) {
        return {
          ok: false,
          code: clubLoad.code || "PRIVATE_PAIRING_LOAD_FAILED",
          message: clubLoad.message || "Không tải được bộ quy tắc theo scope CLB.",
          details: clubLoad,
          rules: [],
          ruleSet: null,
          scopeType: PRIVATE_PAIRING_SCOPE.CLUB,
        };
      }

      return {
        ok: true,
        rules: clubLoad.rules || [],
        ruleSet: clubLoad.ruleSet || null,
        scopeType: PRIVATE_PAIRING_SCOPE.CLUB,
        usedClubFallback: true,
      };
    }

    return {
      ok: true,
      rules: [],
      ruleSet: tournamentLoad.ruleSet || null,
      scopeType: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
      usedClubFallback: false,
    };
  }

  if (!clubId) {
    return { ok: true, rules: [], ruleSet: null, scopeType: null };
  }

  const clubLoad = await loadActivePrivatePairingRulesForRuntime(
    {
      scopeType: PRIVATE_PAIRING_SCOPE.CLUB,
      scopeId: String(clubId),
      tenantId,
    },
    envSource
  );

  if (!clubLoad.ok && !clubLoad.skipped) {
    return {
      ok: false,
      code: clubLoad.code || "PRIVATE_PAIRING_LOAD_FAILED",
      message: clubLoad.message || "Không tải được bộ quy tắc theo scope CLB.",
      details: clubLoad,
      rules: [],
      ruleSet: null,
      scopeType: PRIVATE_PAIRING_SCOPE.CLUB,
    };
  }

  return {
    ok: true,
    rules: clubLoad.rules || [],
    ruleSet: clubLoad.ruleSet || null,
    scopeType: PRIVATE_PAIRING_SCOPE.CLUB,
    usedClubFallback: false,
  };
}

/**
 * Build structured privatePairingError for callers / UI.
 * @param {Object} runtime
 * @returns {{ok:false, code:string, message:string, fatalConflicts?:Array, blockedByPolicy?:Array, validationErrors?:Array}}
 */
export function buildPrivatePairingRuntimeError(runtime = {}) {
  const code = runtime.errorCode || "PRIVATE_PAIRING_RUNTIME_FAILED";
  const fatalConflicts = runtime.meta?.fatalConflicts || [];
  const blockedByPolicy = runtime.meta?.blockedByPolicy || [];
  const validationErrors = runtime.meta?.validationErrors || [];

  let message = "Không thể ghép cặp theo bộ quy tắc riêng.";
  if (code === PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT) {
    message = "Bộ quy tắc ghép cặp xung đột — đã dừng trước khi tạo cặp/đội.";
  } else if (code === PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY) {
    message =
      "Quy tắc cá nhân bị chặn bởi policy giải chính thức — không tiếp tục ghép cặp.";
  } else if (code === PRIVATE_PAIRING_RUNTIME_CODE.RULE_VALIDATION_FAILED) {
    message = "Bộ quy tắc ghép cặp không hợp lệ.";
  } else if (
    code === PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_PAIRING ||
    code === "NO_FEASIBLE_TEAM_FORMATION"
  ) {
    // Docs/QA alias — runtime emits NO_FEASIBLE_PAIRING for team MLP infeasibility.
    message = "Không tìm được phương án ghép cặp/đội thỏa hard rules.";
  } else if (code === PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_GROUP_PLAN) {
    message = "Không tìm được phương án chia bảng thỏa hard rules.";
  } else if (code === PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_MATCHUP) {
    message = "Không tìm được lịch đấu / trận đối đầu thỏa hard rules.";
  } else if (code === PRIVATE_PAIRING_RUNTIME_CODE.PAIRING_SEARCH_LIMIT_REACHED) {
    message = "Đã đạt giới hạn tìm kiếm ghép cặp — không có phương án hợp lệ.";
  }

  return {
    ok: false,
    code,
    message,
    fatalConflicts,
    blockedByPolicy,
    validationErrors,
  };
}

/**
 * Prepare live pairing options: load scoped active rules (canonical),
 * gate fatalConflicts / official blockedByPolicy, then return options for engines.
 *
 * @param {Object} input
 * @returns {Promise<{ok:boolean, skipped?:boolean, pairingOptions?:Object, error?:Object, scopeType?:string|null, ruleSet?:unknown, usedClubFallback?:boolean}>}
 */
export async function prepareLivePrivatePairingOptions(input = {}) {
  const {
    clubId = null,
    tournamentId = null,
    eventId = null,
    tenantId = null,
    competitionClass = COMPETITION_CLASS.INTERNAL,
    pairingConstraints = [],
    envSource,
    seed,
    allowedByPublishedRules = false,
    contextTime,
  } = input;

  if (!isPrivatePairingRuntimeEnabled(envSource)) {
    return {
      ok: true,
      skipped: true,
      scopeType: null,
      ruleSet: null,
      usedClubFallback: false,
      pairingOptions: {
        clubId,
        tournamentId,
        eventId,
        competitionClass,
        pairingConstraints,
        privatePairingRules: [],
        envSource,
        seed,
        allowedByPublishedRules,
        contextTime,
      },
    };
  }

  const loaded = await loadActiveRulesForLiveScope({
    clubId,
    tournamentId,
    tenantId,
    competitionClass,
    envSource,
  });

  if (!loaded.ok) {
    return {
      ok: false,
      error: {
        code: loaded.code || "PRIVATE_PAIRING_LOAD_FAILED",
        message: loaded.message || "Không tải được bộ quy tắc ghép cặp.",
        details: loaded.details || loaded,
      },
      pairingOptions: null,
    };
  }

  const context = {
    teamSize: 2,
    clubId,
    tournamentId,
    eventId,
    competitionClass,
    allowedByPublishedRules,
    contextTime,
  };

  const resolved = resolveActivePrivatePairingRules({
    rules: loaded.rules || [],
    legacyConstraints: pairingConstraints,
    context,
  });

  if (resolved.validationErrors?.length) {
    return {
      ok: false,
      error: {
        code: PRIVATE_PAIRING_RUNTIME_CODE.RULE_VALIDATION_FAILED,
        message: "Bộ quy tắc ghép cặp không hợp lệ.",
        validationErrors: resolved.validationErrors,
      },
      pairingOptions: null,
    };
  }

  if (resolved.fatalConflicts?.length) {
    return {
      ok: false,
      error: {
        code: PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT,
        message: "Bộ quy tắc ghép cặp xung đột — đã dừng trước khi tạo cặp/đội.",
        fatalConflicts: resolved.fatalConflicts,
      },
      pairingOptions: null,
    };
  }

  if (
    isRestrictedCompetitionClass(competitionClass) &&
    (resolved.blockedByPolicy || []).length > 0
  ) {
    return {
      ok: false,
      error: {
        code: PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY,
        message:
          "Quy tắc cá nhân bị chặn bởi policy giải chính thức — không tiếp tục ghép cặp.",
        blockedByPolicy: resolved.blockedByPolicy,
      },
      pairingOptions: null,
    };
  }

  return {
    ok: true,
    skipped: false,
    scopeType: loaded.scopeType,
    ruleSet: loaded.ruleSet,
    usedClubFallback: loaded.usedClubFallback === true,
    pairingOptions: {
      clubId,
      tournamentId,
      eventId,
      competitionClass,
      pairingConstraints,
      privatePairingRules: loaded.rules || [],
      envSource,
      seed,
      allowedByPublishedRules,
      contextTime,
    },
  };
}

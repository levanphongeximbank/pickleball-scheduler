import { COMPETITION_CLASS, RESTRICTED_COMPETITION_CLASSES } from "../constants/enums.js";
import { resolveActivePrivatePairingRules } from "./resolveActiveRules.js";
import {
  PRIVATE_PAIRING_RUNTIME_CODE,
  isPrivatePairingRuntimeEnabled,
} from "./runtimeCodes.js";
import { buildPrivatePairingRuntimeError } from "./prepareLivePrivatePairingOptions.js";

function isRestrictedCompetitionClass(competitionClass) {
  return RESTRICTED_COMPETITION_CLASSES.has(String(competitionClass || "").toUpperCase());
}

/**
 * Map founder court policies → legacy constraint rows for resolve/gates only.
 * Scoring still remaps founder policies separately when runtime is ON.
 */
export function founderCourtPoliciesToLegacyConstraints(policies = []) {
  return (policies || [])
    .filter((policy) => policy && policy.enabled !== false && policy.source === "founder")
    .map((policy, index) => ({
      id: policy.id || policy.sourceId || `founder-policy-${index + 1}`,
      type: policy.type === "avoid_teammate" ? "avoid_partner" : "prefer_partner",
      mode: policy.type === "avoid_teammate" && policy.priority === "HIGH" ? "hard" : "soft",
      anchorPlayerId: policy.playerA,
      targetPlayerIds: [policy.playerB],
      enabled: true,
    }));
}

/**
 * Resolve + gate private pairing for AI / Daily Play runAI.
 * Does not load from DB (callers use prepareLivePrivatePairingOptions async).
 *
 * @param {Object} options runAI options
 * @param {{ teamSize?: number }} [competition]
 * @returns {{ ok: boolean, error?: Object, injection?: Object, resolved?: Object }}
 */
export function gatePrivatePairingForRunAi(options = {}, competition = {}) {
  if (!isPrivatePairingRuntimeEnabled(options.envSource)) {
    return {
      ok: true,
      skipped: true,
      injection: {},
    };
  }

  if (options.privatePairingLoadError) {
    return {
      ok: false,
      error:
        options.privatePairingLoadError.ok === false
          ? options.privatePairingLoadError
          : {
              ok: false,
              code: options.privatePairingLoadError.code || "PRIVATE_PAIRING_LOAD_FAILED",
              message:
                options.privatePairingLoadError.message ||
                "Không tải được bộ quy tắc ghép cặp.",
            },
    };
  }

  const clubId =
    options.clubId ??
    options.activeClub?.id ??
    options.sessionContext?.clubId ??
    null;
  const tournamentId =
    options.tournamentId ?? options.sessionContext?.tournamentId ?? null;
  const competitionClass =
    options.competitionClass || COMPETITION_CLASS.DAILY_PLAY;

  const privateContext = {
    teamSize: Number(competition.teamSize) || 2,
    clubId,
    tournamentId,
    eventId: options.eventId || null,
    competitionClass,
    allowedByPublishedRules: options.allowedByPublishedRules === true,
    contextTime: options.contextTime,
  };

  const legacyConstraints =
    Array.isArray(options.pairingConstraints) && options.pairingConstraints.length
      ? options.pairingConstraints
      : founderCourtPoliciesToLegacyConstraints(options.founderCourtPolicies || []);

  const resolved = resolveActivePrivatePairingRules({
    rules: options.privatePairingRules || [],
    legacyConstraints,
    context: privateContext,
  });

  if (resolved.validationErrors?.length) {
    return {
      ok: false,
      error: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.RULE_VALIDATION_FAILED,
        meta: { validationErrors: resolved.validationErrors },
      }),
      resolved,
    };
  }

  if (resolved.fatalConflicts?.length) {
    return {
      ok: false,
      error: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT,
        meta: { fatalConflicts: resolved.fatalConflicts },
      }),
      resolved,
    };
  }

  if (
    isRestrictedCompetitionClass(competitionClass) &&
    (resolved.blockedByPolicy || []).length > 0
  ) {
    return {
      ok: false,
      error: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY,
        meta: {
          blockedByPolicy: resolved.blockedByPolicy,
          blockedByPolicyCount: resolved.blockedByPolicy.length,
        },
      }),
      resolved,
    };
  }

  return {
    ok: true,
    skipped: false,
    resolved,
    injection: {
      privatePairingRules: options.privatePairingRules || [],
      privatePairingContext: privateContext,
      envSource: options.envSource,
      clubId,
      tournamentId,
      competitionClass,
      allowedByPublishedRules: privateContext.allowedByPublishedRules,
      contextTime: privateContext.contextTime,
      // Avoid second remapping path: founder already in policies → scoring skips founder when ON
      legacyPairingConstraints: [],
    },
  };
}

/**
 * True when pairing candidates are all hard-rejected (no feasible match option).
 * @param {Array<{ totalScore?: number, options?: Array }>} pairingCandidates
 */
export function isNoFeasibleAiPairing(pairingCandidates = []) {
  if (!Array.isArray(pairingCandidates) || pairingCandidates.length === 0) {
    return false;
  }

  return pairingCandidates.every((candidate) => {
    const total = candidate?.totalScore;
    if (!Number.isFinite(total) || total === Number.NEGATIVE_INFINITY) {
      return true;
    }
    const options = candidate?.options || [];
    if (!options.length) {
      return true;
    }
    return options.every(
      (court) =>
        court?.detailScore?.rejected === true ||
        court?.score === Number.NEGATIVE_INFINITY
    );
  });
}

/**
 * Collect rejection codes from best (or all) AI pairing candidates.
 */
export function collectAiPairingRejectionCodes(pairingCandidates = []) {
  const codes = new Set();
  pairingCandidates.forEach((candidate) => {
    (candidate?.options || []).forEach((court) => {
      (court?.detailScore?.rejectionCodes || []).forEach((code) => codes.add(code));
    });
  });
  return [...codes];
}

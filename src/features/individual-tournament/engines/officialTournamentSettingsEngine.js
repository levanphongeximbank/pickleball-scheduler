/**
 * Official Tournament Settings — Phase 2B canonical contract (hardened).
 * Stored under tournament.settings.officialCompetition (JSONB payload).
 *
 * Authority boundaries:
 * - registrationMode / scoringMethod / roundTargets → officialCompetition
 * - groupCount → officialCompetition.groupCount (single persisted draw-config authority;
 *   Setup UI hydrates from here; no parallel blob)
 * - eligibility max skill/rating → settings.eligibilityRules (eligibilityEngine) ONLY
 * - Side-out enum preserved but NOT operational on classic Official live path
 */

import { EVENT_TYPE } from "../../../models/tournament/constants.js";
import { isDoubleEventType, isSingleEventType } from "../../../tournament/engines/officialTournamentEngine.js";
import { DEFAULT_TIME_PREDICTION } from "../../tournament-engine/constants/defaults.js";

export const OFFICIAL_REGISTRATION_MODE = Object.freeze({
  INDIVIDUAL: "individual",
  PAIR: "pair",
});

export const OFFICIAL_REGISTRATION_MODE_RESOLUTION = Object.freeze({
  EXPLICIT: "explicit",
  LEGACY_INFERRED: "legacy_inferred",
  UNRESOLVED_LEGACY: "UNRESOLVED_LEGACY",
});

export const OFFICIAL_SCORING_METHOD = Object.freeze({
  SIDE_OUT: "side_out",
  RALLY: "rally",
});

export const OFFICIAL_ROUND_SCORE_KEY = Object.freeze({
  GROUP: "group",
  ROUND_OF_16: "round_of_16",
  QUARTERFINAL: "quarterfinal",
  SEMIFINAL: "semifinal",
  FINAL: "final",
});

/**
 * Provenance: DEFAULT_TIME_PREDICTION.pointsToWin (tournament-engine defaults).
 * Official classic path historically used the same 11-point game expectation
 * as Engine 4.0 time prediction / referee-v5 pointsToWin default.
 * Do not hardcode a second literal 11 here — import the shared constant.
 */
export const CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT = Number(
  DEFAULT_TIME_PREDICTION.pointsToWin
);

/**
 * Official classic result authority (matchEngine.resolveWinnerFromScore) only
 * rejects draws / picks the higher score — it does NOT own a win-by margin.
 * Do not invent Official winBy=2 from Team/referee-v5.
 */
export const WIN_BY_POLICY_DEFERRED = true;
export const OFFICIAL_WIN_BY_DUPLICATE_AUTHORITY = false;

export const DEFAULT_OFFICIAL_ROUND_TARGETS = Object.freeze({
  [OFFICIAL_ROUND_SCORE_KEY.GROUP]: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  [OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16]: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  [OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL]: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  [OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL]: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  [OFFICIAL_ROUND_SCORE_KEY.FINAL]: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
});

/**
 * Product intent: NEW Official/Open defaults to Side-out once runtime is operational.
 * Until SIDEOUT_OPERATIONAL=true, operable default remains Rally (fail-closed).
 */
export const INTENDED_NEW_TOURNAMENT_SCORING_METHOD = OFFICIAL_SCORING_METHOD.SIDE_OUT;
export const DEFAULT_OFFICIAL_SCORING_METHOD = OFFICIAL_SCORING_METHOD.RALLY;
export const SIDEOUT_DEFAULT_FOR_NEW_TOURNAMENT = false;
export const SIDEOUT_BACKEND_PACKAGE_REQUIRED = true;
export const SIDEOUT_SHARED_EXTRACTION_RECONCILE_AFTER_PR418 = false;
export const SIDEOUT_BACKEND_PACKAGE_PATH =
  "docs/v5/migrations/official-open-sideout-runtime-01/";

/**
 * Classic Official matchLiveSync / RefereeScoreboard has no serving-side state.
 * competition-core has pure SIDE_OUT progression, but Official live RPC only
 * stores score_a/score_b — structured service state requires SQL package.
 * Do not fake client-only Side-out against tournament_match_live.
 */
export const SIDEOUT_OPERATIONAL = false;
export const SIDEOUT_SELECTION_FAIL_CLOSED = true;
export const SIDEOUT_BACKEND_REQUIREMENT =
  "Classic Official live path (matchLiveSync.adjustMatchLiveScore / referee_update_match_score) " +
  "must gain canonical servingSide + serverNumber + scoringMethod + side-out transition authority " +
  "via docs/v5/migrations/official-open-sideout-runtime-01/ before Side-out can be operable " +
  "or the default for NEW Official tournaments.";

/**
 * Normalize Organizer decimal level/rating input.
 * Accepts "4.5" and "4,4" → 4.5 / 4.4. Rejects integers-only coercion via parseInt.
 * Empty → null. Invalid → { ok:false }.
 */
export function parseOfficialDecimalLevelInput(raw) {
  if (raw == null) {
    return { ok: true, value: null, empty: true };
  }
  const text = String(raw).trim();
  if (text === "") {
    return { ok: true, value: null, empty: true };
  }
  if (/[^\d.,\s+-]/.test(text) || (text.match(/[.,]/g) || []).length > 1) {
    return { ok: false, value: null, error: "Giá trị thập phân không hợp lệ." };
  }
  const normalized = text.replace(/\s+/g, "").replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, value: null, error: "Giá trị thập phân không hợp lệ." };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { ok: false, value: null, error: "Giá trị thập phân không hợp lệ." };
  }
  return { ok: true, value, empty: false };
}

/**
 * Mode switch safety: never silently reinterpret entry shapes.
 * Empty registrations → change allowed. Conflicting shapes → block (no auto-delete).
 */
export function assessOfficialRegistrationModeChange(tournament, nextModeRaw) {
  const nextMode = String(nextModeRaw || "").trim().toLowerCase();
  if (
    nextMode !== OFFICIAL_REGISTRATION_MODE.INDIVIDUAL &&
    nextMode !== OFFICIAL_REGISTRATION_MODE.PAIR
  ) {
    return {
      ok: false,
      allowed: false,
      error: "registrationMode must be individual or pair.",
      code: "INVALID_MODE",
    };
  }

  const current = resolveOfficialRegistrationMode(tournament);
  if (
    current.registrationModeResolution === OFFICIAL_REGISTRATION_MODE_RESOLUTION.EXPLICIT &&
    current.registrationMode === nextMode
  ) {
    return { ok: true, allowed: true, reason: "unchanged" };
  }

  const entries = (tournament?.events || []).flatMap((event) =>
    Array.isArray(event?.entries) ? event.entries : []
  );
  if (entries.length === 0) {
    return { ok: true, allowed: true, reason: "no_entries" };
  }

  const counts = entries.map(entryPlayerCount);
  const hasIndividuals = counts.some((n) => n === 1);
  const hasPairs = counts.some((n) => n >= 2);

  if (nextMode === OFFICIAL_REGISTRATION_MODE.PAIR && hasIndividuals) {
    return {
      ok: false,
      allowed: false,
      code: "MODE_SWITCH_BLOCKED_ENTRY_SHAPE",
      error:
        "Đã có đăng ký cá nhân. Không thể đổi sang đăng ký theo cặp mà không làm lệch dữ liệu. Xóa/rút hết hồ sơ trước hoặc giữ chế độ cá nhân.",
    };
  }
  if (nextMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL && hasPairs) {
    return {
      ok: false,
      allowed: false,
      code: "MODE_SWITCH_BLOCKED_ENTRY_SHAPE",
      error:
        "Đã có đăng ký cặp. Không thể đổi sang đăng ký cá nhân mà không làm lệch dữ liệu. Xóa/rút hết hồ sơ trước hoặc giữ chế độ theo cặp.",
    };
  }

  return { ok: true, allowed: true, reason: "compatible_entry_shapes" };
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function entryPlayerCount(entry) {
  return Array.isArray(entry?.playerIds) ? entry.playerIds.filter(Boolean).length : 0;
}

/**
 * Deterministic legacy registration-mode evidence.
 * Returns only individual|pair when unambiguous; otherwise UNRESOLVED_LEGACY.
 */
export function resolveOfficialRegistrationMode(tournament, event = null) {
  const blob = tournament?.settings?.officialCompetition || {};
  const raw = String(blob.registrationMode || "").trim().toLowerCase();
  if (raw === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL || raw === OFFICIAL_REGISTRATION_MODE.PAIR) {
    return {
      registrationMode: raw,
      registrationModeResolution: OFFICIAL_REGISTRATION_MODE_RESOLUTION.EXPLICIT,
      unambiguous: true,
    };
  }

  const ev =
    event ||
    (tournament?.events || []).find((item) => item) ||
    null;
  const eventType = String(ev?.eventType || tournament?.eventType || "").trim();

  if (eventType && isSingleEventType(eventType)) {
    return {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      registrationModeResolution: OFFICIAL_REGISTRATION_MODE_RESOLUTION.LEGACY_INFERRED,
      unambiguous: true,
      evidence: "eventType_singles",
    };
  }

  if (eventType && isDoubleEventType(eventType)) {
    return {
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
      registrationModeResolution: OFFICIAL_REGISTRATION_MODE_RESOLUTION.LEGACY_INFERRED,
      unambiguous: true,
      evidence: "eventType_doubles",
    };
  }

  const entries = Array.isArray(ev?.entries) ? ev.entries : [];
  if (entries.length > 0) {
    const counts = entries.map(entryPlayerCount);
    const allSingles = counts.every((n) => n === 1);
    const allPairs = counts.every((n) => n >= 2);
    if (allSingles) {
      return {
        registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
        registrationModeResolution: OFFICIAL_REGISTRATION_MODE_RESOLUTION.LEGACY_INFERRED,
        unambiguous: true,
        evidence: "entry_shape_all_single",
      };
    }
    if (allPairs) {
      return {
        registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
        registrationModeResolution: OFFICIAL_REGISTRATION_MODE_RESOLUTION.LEGACY_INFERRED,
        unambiguous: true,
        evidence: "entry_shape_all_pair",
      };
    }
  }

  // Groups already drawn with pair-shaped entries can infer pair.
  const groups = Array.isArray(ev?.groups) ? ev.groups : [];
  if (groups.length > 0 && entries.length > 0) {
    const counts = entries.map(entryPlayerCount);
    if (counts.every((n) => n >= 2)) {
      return {
        registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
        registrationModeResolution: OFFICIAL_REGISTRATION_MODE_RESOLUTION.LEGACY_INFERRED,
        unambiguous: true,
        evidence: "published_groups_pair_entries",
      };
    }
  }

  return {
    registrationMode: null,
    registrationModeResolution: OFFICIAL_REGISTRATION_MODE_RESOLUTION.UNRESOLVED_LEGACY,
    unambiguous: false,
    evidence: eventType ? "eventType_unknown_mixed_or_empty" : "no_eventType_no_unambiguous_entries",
  };
}

/** @deprecated Prefer resolveOfficialRegistrationMode — kept for call-site migration. */
export function deriveLegacyOfficialRegistrationMode(tournament, event = null) {
  const resolved = resolveOfficialRegistrationMode(tournament, event);
  return resolved.registrationMode;
}

export function normalizeOfficialRegistrationMode(value, tournament = null, event = null) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL || raw === OFFICIAL_REGISTRATION_MODE.PAIR) {
    return raw;
  }
  return resolveOfficialRegistrationMode(tournament, event).registrationMode;
}

export function normalizeOfficialScoringMethod(value, { allowSideOutPersist = false } = {}) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === OFFICIAL_SCORING_METHOD.SIDE_OUT || raw === "side-out" || raw === "SIDE_OUT") {
    // Enum recognized for future backend wiring; not operable on classic Official path.
    if (allowSideOutPersist && !SIDEOUT_SELECTION_FAIL_CLOSED) {
      return OFFICIAL_SCORING_METHOD.SIDE_OUT;
    }
    return DEFAULT_OFFICIAL_SCORING_METHOD;
  }
  if (raw === OFFICIAL_SCORING_METHOD.RALLY || raw === "RALLY") {
    return OFFICIAL_SCORING_METHOD.RALLY;
  }
  return DEFAULT_OFFICIAL_SCORING_METHOD;
}

export function normalizeOfficialRoundTargets(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const next = {};
  Object.values(OFFICIAL_ROUND_SCORE_KEY).forEach((key) => {
    next[key] = toPositiveInt(
      source[key],
      DEFAULT_OFFICIAL_ROUND_TARGETS[key] ?? CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT
    );
  });
  return next;
}

export function getOfficialCompetitionSettings(tournament) {
  const blob = tournament?.settings?.officialCompetition || {};
  const event = (tournament?.events || [])[0] || null;
  const modeResolved = resolveOfficialRegistrationMode(tournament, event);

  const requestedMethod = String(blob.scoringMethod || "").trim().toLowerCase();
  const requestedSideOut =
    requestedMethod === OFFICIAL_SCORING_METHOD.SIDE_OUT ||
    requestedMethod === "side-out";

  return {
    registrationMode: modeResolved.registrationMode,
    registrationModeResolution: modeResolved.registrationModeResolution,
    registrationModeSource:
      modeResolved.registrationModeResolution === OFFICIAL_REGISTRATION_MODE_RESOLUTION.EXPLICIT
        ? "explicit"
        : modeResolved.registrationModeResolution ===
            OFFICIAL_REGISTRATION_MODE_RESOLUTION.LEGACY_INFERRED
          ? "legacy_derived"
          : "unresolved",
    registrationModeUnresolved:
      modeResolved.registrationModeResolution ===
      OFFICIAL_REGISTRATION_MODE_RESOLUTION.UNRESOLVED_LEGACY,
    scoringMethod: normalizeOfficialScoringMethod(blob.scoringMethod),
    scoringMethodRequested: requestedSideOut
      ? OFFICIAL_SCORING_METHOD.SIDE_OUT
      : normalizeOfficialScoringMethod(blob.scoringMethod),
    scoringMethodOperational: DEFAULT_OFFICIAL_SCORING_METHOD,
    sideOutOperational: SIDEOUT_OPERATIONAL,
    roundTargets: normalizeOfficialRoundTargets(blob.roundTargets),
    groupCount:
      blob.groupCount != null
        ? toPositiveInt(blob.groupCount, 4)
        : event?.groups?.length
          ? toPositiveInt(event.groups.length, 4)
          : 4,
  };
}

/**
 * Patch tournament.settings.officialCompetition.
 * Does NOT write eligibilityRules (use eligibilityEngine.updateEligibilityRules).
 * Does NOT persist side_out as active operable mode (fail-closed).
 * Blocks unsafe registrationMode switches when entry shapes conflict.
 */
export function patchOfficialCompetitionSettings(tournament, patch = {}) {
  const current = getOfficialCompetitionSettings(tournament);
  const nextMode =
    patch.registrationMode != null
      ? String(patch.registrationMode).trim().toLowerCase()
      : current.registrationMode;

  if (
    nextMode != null &&
    nextMode !== OFFICIAL_REGISTRATION_MODE.INDIVIDUAL &&
    nextMode !== OFFICIAL_REGISTRATION_MODE.PAIR
  ) {
    throw new Error("registrationMode must be individual or pair.");
  }

  if (
    patch.registrationMode != null &&
    (nextMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL ||
      nextMode === OFFICIAL_REGISTRATION_MODE.PAIR)
  ) {
    const modeGate = assessOfficialRegistrationModeChange(tournament, nextMode);
    if (!modeGate.allowed) {
      const err = new Error(modeGate.error || "Không thể đổi chế độ đăng ký.");
      err.code = modeGate.code || "MODE_SWITCH_BLOCKED";
      throw err;
    }
  }

  const requestedMethod =
    patch.scoringMethod != null ? patch.scoringMethod : current.scoringMethod;
  const requestedRaw = String(requestedMethod || "").trim().toLowerCase();
  const requestedSideOut =
    requestedRaw === OFFICIAL_SCORING_METHOD.SIDE_OUT ||
    requestedRaw === "side-out" ||
    requestedRaw === "SIDE_OUT";

  if (requestedSideOut && SIDEOUT_SELECTION_FAIL_CLOSED && !SIDEOUT_OPERATIONAL) {
    // Recognized but not operable — do not pretend Side-out was saved as active.
    // Persist Rally as effective method; callers should surface unavailable messaging.
  }

  const nextBlob = {
    registrationMode:
      nextMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL ||
      nextMode === OFFICIAL_REGISTRATION_MODE.PAIR
        ? nextMode
        : current.registrationMode,
    scoringMethod: normalizeOfficialScoringMethod(requestedMethod),
    roundTargets: normalizeOfficialRoundTargets({
      ...current.roundTargets,
      ...(patch.roundTargets || {}),
    }),
    groupCount:
      patch.groupCount != null
        ? toPositiveInt(patch.groupCount, current.groupCount)
        : current.groupCount,
    updatedAt: new Date().toISOString(),
  };

  // Strip legacy duplicate eligibility fields if present on older drafts.
  return {
    ...tournament,
    settings: {
      ...(tournament?.settings || {}),
      officialCompetition: nextBlob,
    },
  };
}

/** Effective scoring method for NEW tournaments once Side-out runtime exists. */
export function resolveNewOfficialTournamentScoringDefault() {
  if (SIDEOUT_OPERATIONAL && SIDEOUT_DEFAULT_FOR_NEW_TOURNAMENT) {
    return INTENDED_NEW_TOURNAMENT_SCORING_METHOD;
  }
  return DEFAULT_OFFICIAL_SCORING_METHOD;
}

export function isOfficialRegistrationModeResolved(tournament, event = null) {
  return resolveOfficialRegistrationMode(tournament, event).unambiguous === true;
}

export function isOfficialPairRegistrationMode(tournament, event = null) {
  return (
    resolveOfficialRegistrationMode(tournament, event).registrationMode ===
    OFFICIAL_REGISTRATION_MODE.PAIR
  );
}

export function isOfficialIndividualRegistrationMode(tournament, event = null) {
  return (
    resolveOfficialRegistrationMode(tournament, event).registrationMode ===
    OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
  );
}

/** Human labels for UI only — never persist Vietnamese as enum. */
export const OFFICIAL_REGISTRATION_MODE_LABELS = Object.freeze({
  [OFFICIAL_REGISTRATION_MODE.INDIVIDUAL]: "Đăng ký cá nhân",
  [OFFICIAL_REGISTRATION_MODE.PAIR]: "Đăng ký theo cặp",
});

export const OFFICIAL_SCORING_METHOD_LABELS = Object.freeze({
  [OFFICIAL_SCORING_METHOD.SIDE_OUT]: "Truyền thống (Side-out)",
  [OFFICIAL_SCORING_METHOD.RALLY]: "Rally (mỗi rally 1 điểm)",
});

export const OFFICIAL_ROUND_SCORE_LABELS = Object.freeze({
  [OFFICIAL_ROUND_SCORE_KEY.GROUP]: "Vòng bảng",
  [OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16]: "Vòng 16",
  [OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL]: "Tứ kết",
  [OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL]: "Bán kết",
  [OFFICIAL_ROUND_SCORE_KEY.FINAL]: "Chung kết",
});

void EVENT_TYPE;

/**
 * Official Tournament Settings — Phase 2B canonical contract (hardened).
 * Stored under tournament.settings.officialCompetition (JSONB payload).
 *
 * Authority boundaries:
 * - tournament identity name → tournament.name (top-level; not duplicated in blob)
 * - registrationMode / scoringMethod / roundTargets / matchFormat → officialCompetition
 *   (Group 1: LEGACY_COMPATIBILITY_DRAFT when Content rules exist)
 * - groupCount → officialCompetition.groupCount is LEGACY_COMPATIBILITY_DRAFT /
 *   leftover blob only. Not active Group 2 authority when
 *   events[].competitionRules.groupStage.groupCount exists. Official Content
 *   callers must use resolveContentGroup2Settings / resolveContentGroupCount.
 * - eligibility max skill/rating → settings.eligibilityRules (eligibilityEngine) ONLY
 * - Side-out enum preserved but NOT operational on classic Official live path
 * - matchFormat BEST_OF_1 is operational (legacy single-game); BEST_OF_3 fail-closed
 *   until Official classic live/result path supports multi-game (scoreA/scoreB only today)
 */

import { EVENT_TYPE, OFFICIAL_MODE } from "../../../models/tournament/constants.js";
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

/**
 * Single persisted match-format authority for Official/Open.
 * Derive bestOf / gamesToWin / maximumGames — never edit those independently.
 */
export const OFFICIAL_MATCH_FORMAT = Object.freeze({
  BEST_OF_1: "BEST_OF_1",
  BEST_OF_3: "BEST_OF_3",
});

export const DEFAULT_OFFICIAL_MATCH_FORMAT = OFFICIAL_MATCH_FORMAT.BEST_OF_1;

/**
 * Classic Official live/result path is single scoreA/scoreB only.
 * CORE-16 can describe multi-game formats, but Official classic completion
 * cannot operationally run BEST_OF_3 without inventing a second match engine.
 */
export const BEST_OF_3_OPERATIONAL = false;
export const BEST_OF_3_SELECTION_FAIL_CLOSED = true;
export const BEST_OF_3_SHARED_CAPABILITY_GAP =
  "Official classic live/result path (scoreA/scoreB + matchEngine) does not model " +
  "multi-game progression. CORE-16 multi-game exists but is not wired to Official " +
  "Organizer/Referee completion or CORE-17 classic propagation. Do not enable BEST_OF_3.";

export const OFFICIAL_MATCH_FORMAT_DERIVED = Object.freeze({
  [OFFICIAL_MATCH_FORMAT.BEST_OF_1]: Object.freeze({
    bestOf: 1,
    gamesToWin: 1,
    maximumGames: 1,
    operational: true,
  }),
  [OFFICIAL_MATCH_FORMAT.BEST_OF_3]: Object.freeze({
    bestOf: 3,
    gamesToWin: 2,
    maximumGames: 3,
    operational: BEST_OF_3_OPERATIONAL,
  }),
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
 * Win-by is enforced by CORE-16 via Official Adapter B live scoring binding.
 * Classic matchEngine / official_open_validate_rally are demoted; they must not
 * invent a second win-by authority. Deprecated flag kept false.
 */
export const WIN_BY_POLICY_DEFERRED = false;
export const OFFICIAL_WIN_BY_DUPLICATE_AUTHORITY = false;

export const DEFAULT_OFFICIAL_ROUND_TARGETS = Object.freeze({
  [OFFICIAL_ROUND_SCORE_KEY.GROUP]: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  [OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16]: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  [OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL]: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  [OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL]: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  [OFFICIAL_ROUND_SCORE_KEY.FINAL]: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
});

export const DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP = 2;

/**
 * Product intent: NEW Official/Open defaults to Side-out once runtime is operational.
 * Until SIDEOUT_OPERATIONAL=true, operable default remains Rally (fail-closed).
 */
export const INTENDED_NEW_TOURNAMENT_SCORING_METHOD = OFFICIAL_SCORING_METHOD.SIDE_OUT;
export const DEFAULT_OFFICIAL_SCORING_METHOD = OFFICIAL_SCORING_METHOD.RALLY;
export const SIDEOUT_DEFAULT_FOR_NEW_TOURNAMENT = true;
export const SIDEOUT_BACKEND_PACKAGE_REQUIRED = false;
export const SIDEOUT_SHARED_EXTRACTION_RECONCILE_AFTER_PR418 = false;
export const SIDEOUT_BACKEND_PACKAGE_PATH =
  "docs/v5/migrations/official-open-sideout-runtime-01/";

/**
 * Side-out execution is bound to CORE-16 via Official Adapter B
 * (officialOpenCore16LiveScoringBinding). Classic tournament_match_live ±1 is
 * demoted to compatibility score projection after CORE-16 ACK.
 * Durable serve SSOT remains match_live_states (Edge/service_role) — session
 * projection until Official scoring Edge host exists. Do NOT apply
 * docs/v5/migrations/official-open-sideout-runtime-01/ for this wave.
 */
export const SIDEOUT_OPERATIONAL = true;
export const SIDEOUT_SELECTION_FAIL_CLOSED = false;
export const SIDEOUT_BACKEND_REQUIREMENT =
  "CORE-16 Side-out commands are bound. Durable serve persistence uses canonical " +
  "match_live_states via Edge (not tournament_match_live columns). Remaining gap: " +
  "Official browser token path cannot call service_role commit RPCs.";

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
    // Persist Side-out only when operational (or explicit allow). Otherwise fail-closed to Rally.
    if ((allowSideOutPersist || SIDEOUT_OPERATIONAL) && !SIDEOUT_SELECTION_FAIL_CLOSED) {
      return OFFICIAL_SCORING_METHOD.SIDE_OUT;
    }
    return DEFAULT_OFFICIAL_SCORING_METHOD;
  }
  if (raw === OFFICIAL_SCORING_METHOD.RALLY || raw === "RALLY") {
    return OFFICIAL_SCORING_METHOD.RALLY;
  }
  return DEFAULT_OFFICIAL_SCORING_METHOD;
}

/**
 * Canonical tournament name (top-level tournament.name). Reject blank/whitespace.
 */
export function normalizeOfficialTournamentName(value) {
  const name = String(value ?? "").trim();
  if (!name) {
    return {
      ok: false,
      name: "",
      error: "Tên giải không được để trống.",
      code: "TOURNAMENT_NAME_REQUIRED",
    };
  }
  return { ok: true, name, error: null, code: null };
}

/**
 * Normalize matchFormat authority. Legacy missing field → BEST_OF_1.
 * BEST_OF_3 may be requested but is never persisted as operable while fail-closed.
 */
export function normalizeOfficialMatchFormat(value, { allowBestOf3Persist = false } = {}) {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
  if (
    raw === OFFICIAL_MATCH_FORMAT.BEST_OF_3 ||
    raw === "BO3" ||
    raw === "BESTOF3" ||
    raw === "3"
  ) {
    if (allowBestOf3Persist && BEST_OF_3_OPERATIONAL && !BEST_OF_3_SELECTION_FAIL_CLOSED) {
      return OFFICIAL_MATCH_FORMAT.BEST_OF_3;
    }
    return DEFAULT_OFFICIAL_MATCH_FORMAT;
  }
  if (
    raw === OFFICIAL_MATCH_FORMAT.BEST_OF_1 ||
    raw === "BO1" ||
    raw === "BESTOF1" ||
    raw === "1" ||
    raw === ""
  ) {
    return OFFICIAL_MATCH_FORMAT.BEST_OF_1;
  }
  return DEFAULT_OFFICIAL_MATCH_FORMAT;
}

export function deriveOfficialMatchFormatRules(matchFormat) {
  const format = normalizeOfficialMatchFormat(matchFormat);
  const derived = OFFICIAL_MATCH_FORMAT_DERIVED[format];
  return {
    matchFormat: format,
    bestOf: derived.bestOf,
    gamesToWin: derived.gamesToWin,
    maximumGames: derived.maximumGames,
    matchFormatIsOperational: derived.operational === true,
  };
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
    scoringMethodOperational:
      SIDEOUT_OPERATIONAL && requestedSideOut
        ? OFFICIAL_SCORING_METHOD.SIDE_OUT
        : DEFAULT_OFFICIAL_SCORING_METHOD,
    sideOutOperational: SIDEOUT_OPERATIONAL,
    matchFormat: normalizeOfficialMatchFormat(blob.matchFormat),
    matchFormatRequested: (() => {
      const raw = String(blob.matchFormat || "")
        .trim()
        .toUpperCase()
        .replace(/-/g, "_");
      return raw === OFFICIAL_MATCH_FORMAT.BEST_OF_3
        ? OFFICIAL_MATCH_FORMAT.BEST_OF_3
        : normalizeOfficialMatchFormat(blob.matchFormat);
    })(),
    matchFormatOperational: DEFAULT_OFFICIAL_MATCH_FORMAT,
    bestOf3Operational: BEST_OF_3_OPERATIONAL,
    ...deriveOfficialMatchFormatRules(blob.matchFormat),
    roundTargets: normalizeOfficialRoundTargets(blob.roundTargets),
    winByEnabled: blob.winByEnabled !== false,
    winByMargin:
      blob.winByMargin != null && Number(blob.winByMargin) >= 1
        ? Math.floor(Number(blob.winByMargin))
        : 2,
    pointCapEnabled: blob.pointCapEnabled === true,
    pointCap:
      blob.pointCap != null && Number(blob.pointCap) >= 1
        ? Math.floor(Number(blob.pointCap))
        : null,
    changeEndsEnabled: blob.changeEndsEnabled === true,
    changeEndsAtPoints:
      blob.changeEndsAtPoints != null && Number(blob.changeEndsAtPoints) >= 1
        ? Math.floor(Number(blob.changeEndsAtPoints))
        : null,
    // LEGACY_COMPATIBILITY_DRAFT / leftover blob. Not Group 2 runtime
    // authority for an explicit Content (use resolveContentGroupCount).
    groupCount:
      blob.groupCount != null
        ? toPositiveInt(blob.groupCount, 4)
        : event?.groups?.length
          ? toPositiveInt(event.groups.length, 4)
          : 4,
    // LEGACY_COMPATIBILITY_DRAFT — Content qualification.directQualifiersPerGroup wins.
    qualifiersPerGroup: toPositiveInt(
      blob.qualifiersPerGroup,
      DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP
    ),
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
    if (
      String(tournament?.officialMode || "") === OFFICIAL_MODE.AI_BALANCE &&
      nextMode === OFFICIAL_REGISTRATION_MODE.PAIR
    ) {
      const err = new Error(
        "AI Balance chỉ nhận đăng ký cá nhân. Không chọn đăng ký theo cặp."
      );
      err.code = "AI_BALANCE_PAIR_REGISTRATION_BLOCKED";
      throw err;
    }
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

  const requestedFormat =
    patch.matchFormat != null ? patch.matchFormat : current.matchFormat;
  const requestedFormatRaw = String(requestedFormat || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_");
  const requestedBestOf3 =
    requestedFormatRaw === OFFICIAL_MATCH_FORMAT.BEST_OF_3 ||
    requestedFormatRaw === "BO3" ||
    requestedFormatRaw === "BESTOF3";

  if (requestedBestOf3 && BEST_OF_3_SELECTION_FAIL_CLOSED && !BEST_OF_3_OPERATIONAL) {
    // Recognized but not operable — persist BEST_OF_1 as effective format.
  }

  const nextBlob = {
    registrationMode:
      nextMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL ||
      nextMode === OFFICIAL_REGISTRATION_MODE.PAIR
        ? nextMode
        : current.registrationMode,
    scoringMethod: normalizeOfficialScoringMethod(requestedMethod, {
      allowSideOutPersist: SIDEOUT_OPERATIONAL === true,
    }),
    matchFormat: normalizeOfficialMatchFormat(requestedFormat),
    roundTargets: normalizeOfficialRoundTargets({
      ...current.roundTargets,
      ...(patch.roundTargets || {}),
    }),
    groupCount:
      patch.groupCount != null
        ? toPositiveInt(patch.groupCount, current.groupCount)
        : current.groupCount,
    qualifiersPerGroup:
      patch.qualifiersPerGroup != null
        ? toPositiveInt(patch.qualifiersPerGroup, current.qualifiersPerGroup)
        : current.qualifiersPerGroup,
    winByEnabled:
      patch.winByEnabled != null ? Boolean(patch.winByEnabled) : current.winByEnabled !== false,
    winByMargin:
      patch.winByMargin != null && Number(patch.winByMargin) >= 1
        ? Math.floor(Number(patch.winByMargin))
        : current.winByMargin || 2,
    pointCapEnabled:
      patch.pointCapEnabled != null
        ? Boolean(patch.pointCapEnabled)
        : current.pointCapEnabled === true,
    pointCap: (() => {
      const enabled =
        patch.pointCapEnabled != null
          ? Boolean(patch.pointCapEnabled)
          : current.pointCapEnabled === true;
      if (!enabled) return null;
      if (patch.pointCap != null && Number(patch.pointCap) >= 1) {
        return Math.floor(Number(patch.pointCap));
      }
      return current.pointCap != null && Number(current.pointCap) >= 1
        ? Math.floor(Number(current.pointCap))
        : null;
    })(),
    changeEndsEnabled:
      patch.changeEndsEnabled != null
        ? Boolean(patch.changeEndsEnabled)
        : current.changeEndsEnabled === true,
    changeEndsAtPoints:
      patch.changeEndsAtPoints != null && Number(patch.changeEndsAtPoints) >= 1
        ? Math.floor(Number(patch.changeEndsAtPoints))
        : current.changeEndsAtPoints || null,
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
  [OFFICIAL_SCORING_METHOD.RALLY]: "Rally",
});

export const OFFICIAL_MATCH_FORMAT_LABELS = Object.freeze({
  [OFFICIAL_MATCH_FORMAT.BEST_OF_1]: "Best of 1",
  [OFFICIAL_MATCH_FORMAT.BEST_OF_3]: "Best of 3",
});

export const OFFICIAL_MATCH_FORMAT_HELPERS = Object.freeze({
  [OFFICIAL_MATCH_FORMAT.BEST_OF_1]: "Thắng 1 ván là thắng trận.",
  [OFFICIAL_MATCH_FORMAT.BEST_OF_3]: "VĐV/đội thắng 2 ván trước sẽ thắng trận.",
});

export const OFFICIAL_ROUND_SCORE_LABELS = Object.freeze({
  [OFFICIAL_ROUND_SCORE_KEY.GROUP]: "Vòng bảng",
  [OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16]: "Vòng 16",
  [OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL]: "Tứ kết",
  [OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL]: "Bán kết",
  [OFFICIAL_ROUND_SCORE_KEY.FINAL]: "Chung kết",
});

void EVENT_TYPE;

/**
 * Official Open vs AI Balance product contract (Phase 2G).
 * Dispatch only — does not invent a pairing or group-draw engine.
 */

import { OFFICIAL_MODE } from "../../../models/tournament/constants.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  resolveOfficialRegistrationMode,
} from "./officialTournamentSettingsEngine.js";

export const OFFICIAL_PAIRING_AUTHORITY = Object.freeze({
  OPEN_RANDOM: "suggestOpenRandomEntriesFromPlayers",
  AI_BALANCE: "suggestBalancedEntriesFromIndividuals",
  NONE: "NONE",
  INVALID: "INVALID",
});

export const OFFICIAL_GROUP_DRAW_AUTHORITY = Object.freeze({
  OPEN_RANDOM: "buildOfficialOpenPlan",
});

export function isOfficialAiBalanceMode(officialMode) {
  return String(officialMode || "") === OFFICIAL_MODE.AI_BALANCE;
}

export function isOfficialOpenMode(officialMode) {
  return String(officialMode || "") !== OFFICIAL_MODE.AI_BALANCE;
}

function entryPlayerCount(entry) {
  return Array.isArray(entry?.playerIds) ? entry.playerIds.filter(Boolean).length : 0;
}

function collectCompetitionEvidence(tournament) {
  const events = Array.isArray(tournament?.events) ? tournament.events : [];
  const registrations = events.flatMap((event) =>
    Array.isArray(event?.entries) ? event.entries : []
  );
  const drawEntries = events.flatMap((event) =>
    Array.isArray(event?.drawEntries) ? event.drawEntries : []
  );
  const groups = events.flatMap((event) =>
    Array.isArray(event?.groups) ? event.groups : []
  );
  const matches = events.flatMap((event) =>
    Array.isArray(event?.matches) ? event.matches : []
  );
  return {
    registrations,
    hasRegistrations: registrations.length > 0,
    hasPairRegistrations: registrations.some((entry) => entryPlayerCount(entry) >= 2),
    hasDrawEntries: drawEntries.length > 0,
    hasGroups: groups.length > 0,
    hasMatches: matches.length > 0,
  };
}

/**
 * Pair-formation dispatch for Official Draw.
 * OPEN + individual → existing random (mode:"open") authority, no rating.
 * OPEN + pair → no pairing.
 * AI_BALANCE + individual → existing AI Balance pairing authority.
 * AI_BALANCE + pair → blocked.
 */
export function resolveOfficialPairingDispatch({
  officialMode,
  registrationMode,
} = {}) {
  const aiBalance = isOfficialAiBalanceMode(officialMode);
  const reg = String(registrationMode || "").trim().toLowerCase();

  if (aiBalance) {
    if (reg === OFFICIAL_REGISTRATION_MODE.PAIR) {
      return {
        ok: false,
        allowed: false,
        pairingAuthority: OFFICIAL_PAIRING_AUTHORITY.INVALID,
        usesRating: false,
        pairingInvoked: false,
        code: "AI_BALANCE_PAIR_REGISTRATION_BLOCKED",
        error:
          "AI Balance chỉ nhận đăng ký cá nhân. Không ghép cặp Open ngẫu nhiên và không nhận đăng ký theo cặp.",
      };
    }
    return {
      ok: true,
      allowed: true,
      pairingAuthority: OFFICIAL_PAIRING_AUTHORITY.AI_BALANCE,
      usesRating: true,
      pairingInvoked: true,
    };
  }

  if (reg === OFFICIAL_REGISTRATION_MODE.PAIR) {
    return {
      ok: true,
      allowed: true,
      pairingAuthority: OFFICIAL_PAIRING_AUTHORITY.NONE,
      usesRating: false,
      pairingInvoked: false,
    };
  }

  return {
    ok: true,
    allowed: true,
    pairingAuthority: OFFICIAL_PAIRING_AUTHORITY.OPEN_RANDOM,
    usesRating: false,
    pairingInvoked: true,
  };
}

/**
 * After valid pairs exist, Open and AI Balance share rating-neutral random group draw.
 */
export function resolveOfficialGroupDrawDispatch({ officialMode } = {}) {
  return {
    ok: true,
    allowed: true,
    officialMode: isOfficialAiBalanceMode(officialMode)
      ? OFFICIAL_MODE.AI_BALANCE
      : OFFICIAL_MODE.OPEN,
    groupDrawAuthority: OFFICIAL_GROUP_DRAW_AUTHORITY.OPEN_RANDOM,
    usesRating: false,
    sharedPolicy: true,
  };
}

export function allowedOfficialRegistrationModes(officialMode) {
  if (isOfficialAiBalanceMode(officialMode)) {
    return [OFFICIAL_REGISTRATION_MODE.INDIVIDUAL];
  }
  return [OFFICIAL_REGISTRATION_MODE.INDIVIDUAL, OFFICIAL_REGISTRATION_MODE.PAIR];
}

/**
 * Open ↔ AI Balance switch. Fail closed when competition data or incompatible
 * pair registrations exist. Never deletes registrations.
 */
export function assessOfficialCompetitionStrategyChange(tournament, nextModeRaw) {
  const nextMode = String(nextModeRaw || "").trim();
  if (nextMode !== OFFICIAL_MODE.OPEN && nextMode !== OFFICIAL_MODE.AI_BALANCE) {
    return {
      ok: false,
      allowed: false,
      code: "INVALID_OFFICIAL_MODE",
      error: "Chế độ giải phải là Open hoặc AI Balance.",
    };
  }

  const current = String(tournament?.officialMode || OFFICIAL_MODE.OPEN);
  if (current === nextMode) {
    return { ok: true, allowed: true, reason: "unchanged" };
  }

  const evidence = collectCompetitionEvidence(tournament);
  if (evidence.hasDrawEntries || evidence.hasGroups || evidence.hasMatches) {
    return {
      ok: false,
      allowed: false,
      code: "MODE_SWITCH_BLOCKED_COMPETITION_DATA",
      error:
        "Đã có cặp bốc thăm, bảng hoặc trận. Không đổi Open ↔ AI Balance. Dùng giải mới hoặc quy trình mở lại/reset đã được duyệt.",
      hasDrawEntries: evidence.hasDrawEntries,
      hasGroups: evidence.hasGroups,
      hasMatches: evidence.hasMatches,
    };
  }

  if (nextMode === OFFICIAL_MODE.AI_BALANCE) {
    const resolved = resolveOfficialRegistrationMode(tournament);
    if (evidence.hasPairRegistrations) {
      return {
        ok: false,
        allowed: false,
        code: "MODE_SWITCH_BLOCKED_PAIR_REGISTRATION",
        error:
          "AI Balance chỉ nhận đăng ký cá nhân. Đã có hồ sơ theo cặp — không đổi chế độ và không xóa đăng ký tự động.",
      };
    }
    if (resolved.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR) {
      if (!evidence.hasRegistrations) {
        return {
          ok: true,
          allowed: true,
          reason: "normalize_registration_to_individual",
          normalizeRegistrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
        };
      }
      return {
        ok: false,
        allowed: false,
        code: "MODE_SWITCH_BLOCKED_PAIR_REGISTRATION",
        error:
          "AI Balance chỉ nhận đăng ký cá nhân. Đã cấu hình đăng ký theo cặp — không đổi chế độ khi còn dữ liệu đăng ký.",
      };
    }
  }

  return { ok: true, allowed: true, reason: "compatible" };
}

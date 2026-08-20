/**
 * Wave O3 — Official Pair Formation mode resolver (Screen 06).
 * Pair Formation ≠ Draw. Resolves from officialMode + registrationMode only.
 */

import { OFFICIAL_MODE } from "../../../models/tournament/constants.js";
import {
  OFFICIAL_PAIRING_AUTHORITY,
  resolveOfficialPairingDispatch,
} from "../../individual-tournament/engines/officialCompetitionStrategyEngine.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  getOfficialCompetitionSettings,
} from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";

export const PAIR_FORMATION_MODE = Object.freeze({
  RANDOM_PAIRING: "RANDOM_PAIRING",
  REGISTERED_PAIRS: "REGISTERED_PAIRS",
  AI_BALANCE_PAIRING: "AI_BALANCE_PAIRING",
  NOT_SUPPORTED: "NOT_SUPPORTED",
});

/**
 * @param {object|null|undefined} tournament
 * @returns {{
 *   ok: boolean,
 *   mode: string,
 *   pairingAuthority: string,
 *   usesRating: boolean,
 *   pairingInvoked: boolean,
 *   registrationMode: string|null,
 *   officialMode: string|null,
 *   error?: string,
 *   code?: string,
 * }}
 */
export function resolveOfficialPairFormationMode(tournament) {
  const officialMode = tournament?.officialMode || null;
  const competition = getOfficialCompetitionSettings(tournament);
  const registrationMode = competition.registrationMode || null;

  if (competition.registrationModeUnresolved || !registrationMode) {
    return {
      ok: false,
      mode: PAIR_FORMATION_MODE.NOT_SUPPORTED,
      pairingAuthority: OFFICIAL_PAIRING_AUTHORITY.INVALID,
      usesRating: false,
      pairingInvoked: false,
      registrationMode: null,
      officialMode,
      code: "REGISTRATION_MODE_UNRESOLVED",
      error: "Chưa xác định chế độ đăng ký (cá nhân / cặp).",
    };
  }

  const dispatch = resolveOfficialPairingDispatch({
    officialMode,
    registrationMode,
  });

  if (!dispatch.ok || dispatch.pairingAuthority === OFFICIAL_PAIRING_AUTHORITY.INVALID) {
    return {
      ok: false,
      mode: PAIR_FORMATION_MODE.NOT_SUPPORTED,
      pairingAuthority: dispatch.pairingAuthority || OFFICIAL_PAIRING_AUTHORITY.INVALID,
      usesRating: false,
      pairingInvoked: false,
      registrationMode,
      officialMode,
      code: dispatch.code || "PAIR_FORMATION_NOT_SUPPORTED",
      error: dispatch.error || "Chế độ ghép cặp không được hỗ trợ.",
    };
  }

  if (dispatch.pairingAuthority === OFFICIAL_PAIRING_AUTHORITY.NONE) {
    return {
      ok: true,
      mode: PAIR_FORMATION_MODE.REGISTERED_PAIRS,
      pairingAuthority: OFFICIAL_PAIRING_AUTHORITY.NONE,
      usesRating: false,
      pairingInvoked: false,
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
      officialMode,
    };
  }

  if (dispatch.pairingAuthority === OFFICIAL_PAIRING_AUTHORITY.AI_BALANCE) {
    return {
      ok: true,
      mode: PAIR_FORMATION_MODE.AI_BALANCE_PAIRING,
      pairingAuthority: OFFICIAL_PAIRING_AUTHORITY.AI_BALANCE,
      usesRating: true,
      pairingInvoked: true,
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      officialMode: OFFICIAL_MODE.AI_BALANCE,
    };
  }

  return {
    ok: true,
    mode: PAIR_FORMATION_MODE.RANDOM_PAIRING,
    pairingAuthority: OFFICIAL_PAIRING_AUTHORITY.OPEN_RANDOM,
    usesRating: false,
    pairingInvoked: true,
    registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    officialMode: OFFICIAL_MODE.OPEN,
  };
}

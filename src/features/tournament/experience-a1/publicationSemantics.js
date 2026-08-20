import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { getRegistrationSettings } from "../../individual-tournament/engines/registrationEngine.js";
import { isOfficialOpenFamily } from "./deriveOverview.js";
import { resolveOfficialRegistrationPublicationStatus } from "../official-tournament-experience/officialExperienceCommands.js";

/** Presentational CTA label only — not domain publication authority. */
export function publicationPrimaryActionLabel(status) {
  return status === "PUBLISHED" ? "Quản lý công bố" : "Công bố đăng ký";
}

/**
 * Derive publication from existing registration/status domain for Official.
 * Internal/other families: no distinct publication state (legacy false).
 */
export function hasCanonicalRegistrationPublication(tournament) {
  if (!tournament) return false;
  if (isOfficialOpenFamily(tournament)) {
    return resolveOfficialRegistrationPublicationStatus(tournament) === "PUBLISHED";
  }
  return false;
}

export function resolveRegistrationPublicationStatus(tournament) {
  if (isOfficialOpenFamily(tournament)) {
    return resolveOfficialRegistrationPublicationStatus(tournament);
  }
  return "NOT_PUBLISHED";
}

export function registrationPublicationStatusLabel(tournament) {
  if (hasCanonicalRegistrationPublication(tournament)) {
    const settings = getRegistrationSettings(tournament);
    if (settings.lockedAt || settings.closedAt) {
      return "Đã khóa đăng ký";
    }
    if (String(tournament?.status || "") === TOURNAMENT_STATUS.REGISTRATION) {
      return "Đang mở đăng ký";
    }
    return "Đã công bố đăng ký";
  }
  return "Chưa công bố đăng ký";
}

/**
 * Wave 5 — explicit Club identity for domain queries.
 *
 * A Club-scoped domain query must receive a canonical clubId argument.
 * Preference (getActiveClubId / localStorage) is not existence and is not
 * a legal default inside domain services.
 *
 * UNRESOLVED CLUB ≠ EMPTY BUSINESS DATA.
 */

export const CLUB_CONTEXT_ERROR_CODE = Object.freeze({
  CLUB_REQUIRED: "CLUB_REQUIRED",
  CLUB_EMPTY: "CLUB_EMPTY",
  CLUB_CONTEXT_NOT_READY: "CLUB_CONTEXT_NOT_READY",
});

export function createClubContextError(
  code = CLUB_CONTEXT_ERROR_CODE.CLUB_REQUIRED,
  message = "Club context is required."
) {
  const error = new Error(message);
  error.name = "ClubContextError";
  error.code = code;
  return error;
}

/**
 * @param {unknown} clubId
 * @returns {{ ok: true, clubId: string } | { ok: false, code: string, clubId: null }}
 */
export function requireExplicitClubId(clubId) {
  const id = String(clubId || "").trim();
  if (!id) {
    return {
      ok: false,
      code: CLUB_CONTEXT_ERROR_CODE.CLUB_REQUIRED,
      clubId: null,
    };
  }
  return { ok: true, clubId: id };
}

/**
 * @param {unknown} clubId
 * @returns {string}
 */
export function assertExplicitClubId(clubId) {
  const required = requireExplicitClubId(clubId);
  if (!required.ok) {
    throw createClubContextError(
      required.code,
      "CLUB_REQUIRED — Club-scoped query needs an explicit canonical clubId."
    );
  }
  return required.clubId;
}

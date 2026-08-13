/**
 * Canonical Tournament CAS / VERSION_CONFLICT helpers (IT-E2E-001 / IT-REV-006).
 * Server owns monotonic `canonical_tournaments.version`.
 * Internal mode: expected_version is mandatory (fail closed).
 */

export const CANONICAL_TOURNAMENT_VERSION_CONFLICT = "VERSION_CONFLICT";
export const CANONICAL_TOURNAMENT_VERSION_REQUIRED = "VERSION_REQUIRED";

export const CANONICAL_VERSION_CONFLICT_USER_MESSAGE =
  "Dữ liệu giải đã thay đổi ở phiên khác. Hệ thống đã không ghi đè. Vui lòng tải trạng thái mới nhất và thực hiện lại.";

export const CANONICAL_VERSION_REQUIRED_USER_MESSAGE =
  "Thiếu phiên bản dữ liệu giải (expectedVersion). Hệ thống đã từ chối ghi để tránh ghi đè.";

export function resolveCanonicalExpectedVersion(tournamentOrVersion) {
  if (tournamentOrVersion == null) return null;
  if (typeof tournamentOrVersion === "number") {
    return Number.isFinite(tournamentOrVersion) ? tournamentOrVersion : null;
  }
  const raw = tournamentOrVersion.version;
  if (raw == null || raw === "") return null;
  const version = Number(raw);
  return Number.isFinite(version) ? version : null;
}

/**
 * Internal updates must always carry a finite expectedVersion.
 * Team / other modes may omit (backward compatible).
 */
export function assertInternalExpectedVersion(expectedVersion, options = {}) {
  const mode = String(options.mode || "").trim();
  if (mode && mode !== "internal_tournament") {
    return { ok: true, required: false, expectedVersion: resolveCanonicalExpectedVersion(expectedVersion) };
  }
  const resolved = resolveCanonicalExpectedVersion(expectedVersion);
  if (resolved == null) {
    return {
      ok: false,
      required: true,
      code: CANONICAL_TOURNAMENT_VERSION_REQUIRED,
      error: CANONICAL_VERSION_REQUIRED_USER_MESSAGE,
      expectedVersion: null,
    };
  }
  return { ok: true, required: true, expectedVersion: resolved };
}

export function isCanonicalVersionConflict(result) {
  if (!result || result.ok) return false;
  const code = String(result.code || "").toUpperCase();
  return (
    code === CANONICAL_TOURNAMENT_VERSION_CONFLICT ||
    code === "VERSION_CONFLICT" ||
    /VERSION_CONFLICT/i.test(String(result.error || ""))
  );
}

export function isCanonicalVersionRequired(result) {
  if (!result || result.ok) return false;
  const code = String(result.code || "").toUpperCase();
  return (
    code === CANONICAL_TOURNAMENT_VERSION_REQUIRED ||
    code === "VERSION_REQUIRED" ||
    /VERSION_REQUIRED/i.test(String(result.error || ""))
  );
}

export function formatCanonicalVersionConflictError(result) {
  if (isCanonicalVersionRequired(result)) {
    return CANONICAL_VERSION_REQUIRED_USER_MESSAGE;
  }
  if (!isCanonicalVersionConflict(result)) {
    return result?.error || "Không lưu được giải.";
  }
  return CANONICAL_VERSION_CONFLICT_USER_MESSAGE;
}

/**
 * Chain the next expectedVersion from a successful update result.
 * Never read React state for sequential mutations.
 */
export function chainExpectedVersionFromResult(result) {
  if (!result?.ok || !result.tournament) return null;
  return resolveCanonicalExpectedVersion(result.tournament);
}

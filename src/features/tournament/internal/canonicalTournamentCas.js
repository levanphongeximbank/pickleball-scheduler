/**
 * Canonical Tournament CAS / VERSION_CONFLICT helpers (IT-E2E-001 / IT-REV-006).
 * Server owns monotonic `canonical_tournaments.version`.
 * Internal mode: expected_version is mandatory (fail closed).
 */

export const CANONICAL_TOURNAMENT_VERSION_CONFLICT = "VERSION_CONFLICT";
export const CANONICAL_TOURNAMENT_VERSION_REQUIRED = "VERSION_REQUIRED";

export const CANONICAL_VERSION_CONFLICT_USER_MESSAGE =
  "Dữ liệu giải đã thay đổi ở phiên khác. Hệ thống không ghi đè. Vui lòng tải trạng thái mới nhất rồi thực hiện lại.";

export const CANONICAL_VERSION_REQUIRED_USER_MESSAGE =
  "Không lưu được vì phiên bản dữ liệu giải chưa sẵn sàng. Vui lòng tải lại rồi thử lại.";

export const INTERNAL_VERSION_SYNCING_USER_MESSAGE =
  "Đang đồng bộ trạng thái giải. Vui lòng thử lại sau giây lát.";

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
  const error = String(result.error || "");
  return (
    code === CANONICAL_TOURNAMENT_VERSION_REQUIRED ||
    code === "VERSION_REQUIRED" ||
    /VERSION_REQUIRED/i.test(error) ||
    /expected_version is required/i.test(error)
  );
}

/**
 * Internal durable actions must not run until id + positive server version exist.
 */
export function assertInternalTournamentReadyForMutation(tournament, options = {}) {
  const mode = String(options.mode || tournament?.mode || "").trim();
  if (mode && mode !== "internal_tournament") {
    return {
      ok: true,
      skipped: true,
      expectedVersion: resolveCanonicalExpectedVersion(tournament),
    };
  }
  if (!tournament?.id) {
    return {
      ok: false,
      code: CANONICAL_TOURNAMENT_VERSION_REQUIRED,
      error: INTERNAL_VERSION_SYNCING_USER_MESSAGE,
      reason: "missing_tournament",
    };
  }
  const expectedVersion = resolveCanonicalExpectedVersion(tournament);
  if (expectedVersion == null || expectedVersion < 1) {
    return {
      ok: false,
      code: CANONICAL_TOURNAMENT_VERSION_REQUIRED,
      error: INTERNAL_VERSION_SYNCING_USER_MESSAGE,
      reason: "missing_version",
    };
  }
  return { ok: true, expectedVersion };
}

export function formatCanonicalVersionConflictError(result) {
  if (isCanonicalVersionRequired(result)) {
    if (
      result?.error === INTERNAL_VERSION_SYNCING_USER_MESSAGE ||
      result?.reason === "missing_version" ||
      result?.reason === "missing_tournament"
    ) {
      return INTERNAL_VERSION_SYNCING_USER_MESSAGE;
    }
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

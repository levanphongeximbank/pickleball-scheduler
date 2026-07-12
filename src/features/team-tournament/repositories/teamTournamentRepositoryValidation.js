import {
  REPOSITORY_ERROR_CODES,
  REPOSITORY_REALTIME_FALLBACK,
} from "./teamTournamentRepositoryTypes.js";
import {
  formatLineupValidationError,
  isLineupValidationErrorCode,
  mapRpcLineupValidationPayload,
} from "../engines/lineupValidationContract.js";

/**
 * @template T
 * @param {string} code
 * @param {string} error
 * @param {Record<string, unknown>} [details]
 * @returns {import('./teamTournamentRepositoryTypes.js').RepositoryResult<T>}
 */
export function repositoryFailure(code, error, details = {}) {
  return {
    ok: false,
    code,
    error,
    details,
  };
}

/**
 * @template T
 * @param {T} data
 * @param {Partial<import('./teamTournamentRepositoryTypes.js').RepositoryResult<T>>} [extras]
 * @returns {import('./teamTournamentRepositoryTypes.js').RepositoryResult<T>}
 */
export function repositorySuccess(data, extras = {}) {
  return {
    ok: true,
    data,
    ...extras,
  };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPresentString(value) {
  return value != null && String(value).trim() !== "";
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFiniteVersion(value) {
  return value != null && value !== "" && Number.isFinite(Number(value));
}

/**
 * @param {unknown} commandOptions
 * @param {string} methodName
 * @returns {import('./teamTournamentRepositoryTypes.js').RepositoryResult<never> | null}
 */
export function validateVersionedCommandOptions(commandOptions, methodName) {
  if (commandOptions == null || typeof commandOptions !== "object") {
    return repositoryFailure(
      REPOSITORY_ERROR_CODES.INVALID_COMMAND_OPTIONS,
      `${methodName} requires command options object.`,
      { methodName }
    );
  }

  if (!isFiniteVersion(commandOptions.expectedVersion)) {
    return repositoryFailure(
      REPOSITORY_ERROR_CODES.MISSING_EXPECTED_VERSION,
      `${methodName} requires expectedVersion.`,
      { methodName }
    );
  }

  if (!isPresentString(commandOptions.idempotencyKey)) {
    return repositoryFailure(
      REPOSITORY_ERROR_CODES.MISSING_IDEMPOTENCY_KEY,
      `${methodName} requires idempotencyKey.`,
      { methodName }
    );
  }

  return null;
}

/**
 * Cloud/shadow reads must not trust client-supplied viewerTeamId.
 * @param {import('./teamTournamentRepositoryTypes.js').ReadOptions | import('./teamTournamentRepositoryTypes.js').VisibleLineupsReadOptions | undefined} options
 * @param {'cloud'|'shadow'|'blob'} provider
 * @returns {import('./teamTournamentRepositoryTypes.js').RepositoryResult<never> | null}
 */
export function rejectClientViewerTeamIdForCloud(options, provider) {
  if (provider !== "cloud" && provider !== "shadow") {
    return null;
  }

  if (options?.viewerTeamId != null && String(options.viewerTeamId).trim() !== "") {
    return repositoryFailure(
      REPOSITORY_ERROR_CODES.VIEWER_TEAM_ID_CLIENT_OVERRIDE_REJECTED,
      "viewerTeamId must be derived from auth/session; client override is rejected.",
      { viewerTeamId: String(options.viewerTeamId) }
    );
  }

  return null;
}

/**
 * Normalize RPC/service payloads into RepositoryResult shape.
 * @template T
 * @param {object | null | undefined} raw
 * @param {Partial<import('./teamTournamentRepositoryTypes.js').RepositoryResult<T>>} [extras]
 * @returns {import('./teamTournamentRepositoryTypes.js').RepositoryResult<T>}
 */
export function normalizeRepositoryResult(raw, extras = {}) {
  if (!raw) {
    return repositoryFailure("EMPTY_RESPONSE", "Empty repository response.");
  }

  if (raw.ok === false) {
    const code = raw.code || "REPOSITORY_FAILED";
    const validation = isLineupValidationErrorCode(code)
      ? mapRpcLineupValidationPayload(raw)
      : null;

    return {
      ok: false,
      code,
      error: validation
        ? formatLineupValidationError(raw, raw.error || "Repository operation failed.")
        : raw.error || raw.message || "Repository operation failed.",
      version: raw.version ?? raw.expected_version ?? raw.actual_version,
      replayed: raw.replayed === true,
      validation,
      details: {
        entity: raw.entity,
        expected_version: raw.expected_version,
        actual_version: raw.actual_version,
        fieldErrors: raw.fieldErrors,
        invalidPlayerIds: raw.invalidPlayerIds,
        invalidDisciplineIds: raw.invalidDisciplineIds,
        serverTime: raw.serverTime,
        lineupVersion: raw.lineupVersion,
        ...(raw.details && typeof raw.details === "object" ? raw.details : {}),
      },
      provider: raw.provider,
      ...extras,
    };
  }

  const data =
    raw.data !== undefined
      ? raw.data
      : raw.tournament !== undefined
        ? raw.tournament
        : raw.teams !== undefined
          ? raw.teams
          : raw.matchups !== undefined
            ? raw.matchups
            : raw.lineups !== undefined
              ? raw.lineups
              : raw.standings !== undefined
                ? raw.standings
                : raw;

  return repositorySuccess(data, {
    version: raw.version ?? raw.actual_version,
    replayed: raw.replayed === true,
    details: raw.details,
    provider: raw.provider,
    ...extras,
  });
}

/**
 * @param {string} methodName
 * @returns {Promise<import('./teamTournamentRepositoryTypes.js').RepositoryResult<never>>}
 */
export async function notImplementedRepositoryResult(methodName) {
  return repositoryFailure(
    REPOSITORY_ERROR_CODES.NOT_IMPLEMENTED,
    `${methodName} is not implemented for this repository provider.`,
    { methodName }
  );
}

/**
 * @returns {Promise<import('./teamTournamentRepositoryTypes.js').RepositoryResult<import('./teamTournamentRepositoryTypes.js').TournamentSubscriptionResult>>}
 */
export async function notImplementedSubscriptionResult() {
  return repositoryFailure(
    REPOSITORY_ERROR_CODES.REALTIME_NOT_IMPLEMENTED,
    "Realtime subscription is not available.",
    {
      ...REPOSITORY_REALTIME_FALLBACK,
      hint: "Use explicit reload or polling until subscription is wired.",
    }
  );
}

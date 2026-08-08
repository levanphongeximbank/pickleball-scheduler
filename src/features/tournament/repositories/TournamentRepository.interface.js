/**
 * Canonical Tournament repository contract — CLOUD ONLY, async RPC-backed.
 * Pages/services must depend on this boundary — never on storage details.
 *
 * @typedef {object} TournamentRepository
 * @property {'cloud'} kind
 * @property {(clubId: string, filters?: object) => Promise<object>} list
 * @property {(clubId: string, tournamentId: string) => Promise<object>} get
 * @property {(clubId: string, options?: object) => Promise<object>} create
 * @property {(clubId: string, tournamentId: string, patch?: object, options?: object) => Promise<object>} update
 * @property {(clubId: string, tournamentId: string) => Promise<object>} delete
 * @property {(clubId: string, filters?: object) => Promise<object>} listMine
 * @property {(clubId: string, tournamentId: string, engineState: object, options?: object) => Promise<object>} applyEngineState
 */

export const TOURNAMENT_REPOSITORY_KINDS = Object.freeze({
  CLOUD: "cloud",
});

export const TOURNAMENT_REPO_ERROR = Object.freeze({
  MISSING_CLUB: "TOURNAMENT_MISSING_CLUB",
  MISSING_TENANT: "TOURNAMENT_MISSING_TENANT",
  NOT_FOUND: "TOURNAMENT_NOT_FOUND",
  FORBIDDEN: "TOURNAMENT_FORBIDDEN",
  CLOUD_UNAVAILABLE: "TOURNAMENT_CLOUD_UNAVAILABLE",
});

/**
 * Canonical Tournament repository contract.
 * Pages/services must depend on this boundary — never on storage details.
 *
 * @typedef {object} TournamentRepository
 * @property {'transitional_blob'|'cloud'} kind
 * @property {(clubId: string, filters?: object) => object[]} list
 * @property {(clubId: string, tournamentId: string) => object|null} get
 * @property {(clubId: string, options?: object) => {ok:boolean,tournament?:object,error?:string,code?:string}} create
 * @property {(clubId: string, tournamentId: string, patch?: object, options?: object) => {ok:boolean,tournament?:object,error?:string,code?:string}} update
 * @property {(clubId: string, tournamentId: string) => {ok:boolean,error?:string,code?:string}} delete
 * @property {(clubId: string, filters?: object) => object[]} listMine
 * @property {(clubId: string, tournamentId: string, engineState: object, options?: object) => {ok:boolean,tournament?:object,error?:string,code?:string}} applyEngineState
 */

export const TOURNAMENT_REPOSITORY_KINDS = Object.freeze({
  TRANSITIONAL_BLOB: "transitional_blob",
  CLOUD: "cloud",
});

export const TOURNAMENT_REPO_ERROR = Object.freeze({
  MISSING_CLUB: "TOURNAMENT_MISSING_CLUB",
  MISSING_TENANT: "TOURNAMENT_MISSING_TENANT",
  NOT_FOUND: "TOURNAMENT_NOT_FOUND",
  FORBIDDEN: "TOURNAMENT_FORBIDDEN",
  CLOUD_UNAVAILABLE: "TOURNAMENT_CLOUD_UNAVAILABLE",
});

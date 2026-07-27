/**
 * Public Catalog — certified remote public read (PUBLIC-CATALOG-01/02).
 *
 * Provides:
 * - Canonical public Club / Court / Tournament / Ranking DTO projectors
 * - Typed facade list APIs (Platform Result)
 * - Supabase RPC remote repository (no mock fallback, no mutations)
 * - Authored SQL/RLS packages (NOT auto-applied)
 *
 * Does NOT:
 * - Cut over Public Portal / Experience Channels Production runtime
 * - Become Competition Engine / VPR / Player Rating writers
 * - Apply Staging or Production SQL without Owner GO
 * - Open anon access to club_data_v3 or private ops tables
 */

export { PUBLIC_CATALOG_PHASE, PUBLIC_CATALOG_02_PHASE } from "./constants/index.js";

export {
  PUBLIC_CATALOG_DEFAULT_LIMIT,
  PUBLIC_CATALOG_MAX_LIMIT,
  PUBLIC_CATALOG_DEFAULT_OFFSET,
  PUBLIC_CLUB_SORT,
  PUBLIC_COURT_SORT,
  PUBLIC_TOURNAMENT_SORT,
  PUBLIC_RANKING_SORT,
  PUBLIC_CLUB_DEFAULT_SORT,
  PUBLIC_COURT_DEFAULT_SORT,
  PUBLIC_TOURNAMENT_DEFAULT_SORT,
  PUBLIC_RANKING_DEFAULT_SORT,
  PUBLIC_CATALOG_PROVENANCE,
  PUBLIC_CATALOG_PROVENANCE_VALUES,
  isPublicCatalogProvenance,
  PUBLIC_CLUB_PUBLICATION_STATE,
  PUBLIC_COURT_PUBLICATION_STATE,
  PUBLIC_COURT_OPERATIONAL_STATE,
  PUBLIC_COURT_TYPE,
  PUBLIC_COURT_TYPE_VALUES,
  isPublicCourtType,
} from "./constants/index.js";

export {
  PUBLIC_CATALOG_ERROR_CODE,
  isPublicCatalogErrorCode,
  PublicCatalogError,
  isPublicCatalogError,
} from "./errors/index.js";

export {
  PUBLIC_CLUB_DTO_KEYS,
  PUBLIC_CLUB_FORBIDDEN_KEYS,
  PUBLIC_COURT_DTO_KEYS,
  PUBLIC_COURT_FORBIDDEN_KEYS,
  PUBLIC_TOURNAMENT_DTO_KEYS,
  PUBLIC_TOURNAMENT_FORBIDDEN_KEYS,
  PUBLIC_RANKING_DTO_KEYS,
  PUBLIC_RANKING_FORBIDDEN_KEYS,
  normalizePaginationInput,
  normalizeClubSort,
  normalizeCourtSort,
  normalizeTournamentSort,
  normalizeRankingSort,
  normalizeOptionalClubIdFilter,
  normalizeOptionalCategoryFilter,
  deepFreeze,
} from "./contracts/index.js";

export {
  projectPublicClub,
  tryProjectPublicClub,
  projectPublicCourt,
  tryProjectPublicCourt,
  projectPublicTournament,
  tryProjectPublicTournament,
  projectPublicRanking,
  tryProjectPublicRanking,
} from "./projections/index.js";

export {
  PUBLIC_CATALOG_REPOSITORY_METHODS,
  matchesPublicCatalogRepositoryPort,
  createUnimplementedPublicCatalogRepositoryPort,
} from "./ports/index.js";

export { createPublicCatalogFacade } from "./application/index.js";

export {
  PUBLIC_CATALOG_RPC,
  PUBLIC_CATALOG_TABLE,
  PUBLIC_CATALOG_SQL_PACKAGE,
  PUBLIC_CATALOG_02_SQL_PACKAGE,
  PUBLIC_CATALOG_SQL_MANIFEST,
  PUBLIC_CATALOG_02_SQL_MANIFEST,
  createSupabasePublicCatalogRepository,
  createInMemoryPublicCatalogRepository,
  assertSupabasePublicCatalogClient,
  mapSupabasePublicCatalogError,
} from "./persistence/index.js";

export {
  createRemotePublicCatalogFacade,
  listPublicClubsRemote,
  listPublicCourtsRemote,
  listPublicTournamentsRemote,
  listPublicRankingsRemote,
} from "./remote/index.js";

export { isOk, isFail } from "../../core/platform/contracts/result.js";

/** Barrel export allowlist — consumers import from this index only. */
export const PUBLIC_CATALOG_PUBLIC_EXPORTS = Object.freeze([
  "PUBLIC_CATALOG_PHASE",
  "createPublicCatalogFacade",
  "listPublicClubsRemote",
  "listPublicCourtsRemote",
  "listPublicTournamentsRemote",
  "listPublicRankingsRemote",
  "projectPublicClub",
  "projectPublicCourt",
  "projectPublicTournament",
  "projectPublicRanking",
  "PUBLIC_CLUB_DTO_KEYS",
  "PUBLIC_COURT_DTO_KEYS",
  "PUBLIC_TOURNAMENT_DTO_KEYS",
  "PUBLIC_RANKING_DTO_KEYS",
  "PUBLIC_CATALOG_SQL_MANIFEST",
]);

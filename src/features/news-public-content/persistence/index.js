export {
  NEWS_TABLE,
  NEWS_TABLE_NAME_VALUES,
  NEWS_RPC,
  NEWS_SQL_PACKAGE_DIR,
  NEWS_SQL_PACKAGE_FILES,
} from "./schema.js";

export {
  loadNews02SqlPackageManifest,
  assertNews02SqlApplyRefused,
} from "./sqlManifest.js";

export {
  assertSupabaseNewsClient,
  assertNewsTableName,
  createFakeSupabaseNewsClient,
  mapSupabaseNewsError,
  createSupabaseContentRepository,
  domainToItemRow,
  domainToRevisionRow,
  rowsToDomainAggregate,
  publicRpcRowToCandidate,
} from "./supabase/index.js";

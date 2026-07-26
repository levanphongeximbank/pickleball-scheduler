/**
 * Persistence schema constants for Public Catalog RPCs / tables.
 */

export const PUBLIC_CATALOG_RPC = Object.freeze({
  LIST_CLUBS: "public_catalog_list_clubs",
  LIST_COURTS: "public_catalog_list_courts",
});

export const PUBLIC_CATALOG_TABLE = Object.freeze({
  COURTS: "public_catalog_courts",
});

export const PUBLIC_CATALOG_SQL_PACKAGE = Object.freeze({
  APPLY: "docs/public-catalog/pc-01/10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql",
  ROLLBACK: "docs/public-catalog/pc-01/90_PUBLIC_CATALOG_01_ROLLBACK.sql",
  VERIFY: "docs/public-catalog/pc-01/99_PUBLIC_CATALOG_01_VERIFICATION.sql",
});

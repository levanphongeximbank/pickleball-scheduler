/**
 * SQL package manifests — authored only; NOT auto-applied.
 */

import {
  PUBLIC_CATALOG_SQL_PACKAGE,
  PUBLIC_CATALOG_02_SQL_PACKAGE,
} from "./schema.js";

export const PUBLIC_CATALOG_SQL_MANIFEST = Object.freeze({
  phase: "PUBLIC-CATALOG-01",
  applyStatus: "AUTHORED_NOT_APPLIED",
  stagingApply: false,
  productionApply: false,
  files: Object.freeze([
    PUBLIC_CATALOG_SQL_PACKAGE.APPLY,
    PUBLIC_CATALOG_SQL_PACKAGE.ROLLBACK,
    PUBLIC_CATALOG_SQL_PACKAGE.VERIFY,
  ]),
});

export const PUBLIC_CATALOG_02_SQL_MANIFEST = Object.freeze({
  phase: "PUBLIC-CATALOG-02",
  applyStatus: "AUTHORED_NOT_APPLIED",
  stagingApply: false,
  productionApply: false,
  files: Object.freeze([
    PUBLIC_CATALOG_02_SQL_PACKAGE.APPLY,
    PUBLIC_CATALOG_02_SQL_PACKAGE.ROLLBACK,
  ]),
});

/**
 * NEWS-02 SQL package manifest — inventory only. Never applies SQL.
 */

import {
  NEWS_SQL_PACKAGE_DIR,
  NEWS_SQL_PACKAGE_FILES,
  NEWS_TABLE_NAME_VALUES,
  NEWS_RPC,
} from "./schema.js";

export function loadNews02SqlPackageManifest() {
  return Object.freeze({
    phase: "NEWS-02",
    packageDir: NEWS_SQL_PACKAGE_DIR,
    files: NEWS_SQL_PACKAGE_FILES,
    tables: NEWS_TABLE_NAME_VALUES,
    rpcs: Object.freeze(Object.values(NEWS_RPC)),
    authoredOnly: true,
    applied: false,
    stagingApplied: false,
    productionApplied: false,
    applyAllowed: false,
    refuseApplyReason:
      "NEWS-02 authors SQL only. Staging/Production apply is NEWS-03 Owner gate.",
  });
}

/**
 * Hard refuse any apply attempt in this phase.
 * @param {{ environment?: string }} [opts]
 */
export function assertNews02SqlApplyRefused(opts = {}) {
  const env = opts.environment || "unknown";
  return Object.freeze({
    allowed: false,
    environment: env,
    reason:
      "NEWS-02 must not apply SQL. Use NEWS-03 staging apply procedure after Owner GO.",
  });
}

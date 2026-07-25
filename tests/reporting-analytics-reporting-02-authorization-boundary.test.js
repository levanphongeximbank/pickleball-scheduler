import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as reporting from "../src/features/reporting-analytics/index.js";
import { baseActor, clubScope } from "./support/reporting-analytics-test-doubles.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rls = readFileSync(
  path.join(root, "docs", "reporting-analytics", "reporting-02", "30_REPORTING_02_RLS.sql"),
  "utf8"
);
const ownership = readFileSync(
  path.join(root, "docs", "reporting-analytics", "reporting-02", "00_OWNERSHIP_AND_SECURITY.md"),
  "utf8"
);

test("Reporting authorization boundary denies missing actors, tenant mismatches, and forbidden scopes", () => {
  assert.equal(reporting.authorizeExecuteReport(null, clubScope()).ok, false);
  assert.equal(
    reporting.authorizeExecuteReport(baseActor({ tenantId: "tenant-other" }), clubScope()).ok,
    false
  );
  assert.equal(
    reporting.authorizeExecuteReport(baseActor({ clubIds: ["club-other"] }), clubScope()).ok,
    false
  );
  assert.equal(
    reporting.authorizeReporting(
      baseActor(),
      reporting.REPORTING_PERMISSIONS.REPORT_EXECUTE,
      { kind: reporting.REPORT_SCOPE_KIND.PLATFORM_CROSS_TENANT }
    ).ok,
    false
  );
});

test("authenticated SQL policies are SELECT-only and document the trusted server boundary", () => {
  assert.match(rls, /FOR SELECT\s+TO authenticated/i);
  assert.doesNotMatch(rls, /FOR\s+(?:INSERT|UPDATE|DELETE)[\s\S]*?TO authenticated/i);
  assert.match(rls, /trusted service_role\s*\/\s*[\r\n\s-]*server adapters/i);
  assert.match(ownership, /trusted service-role\s*\/\s*server adapters/i);
});

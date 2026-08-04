import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const evidence = JSON.parse(
  fs.readFileSync(new URL("../docs/v6/STAGING_SECURITY_DEFINER_ACL_AUDIT.json", import.meta.url), "utf8"),
);

test("ACL audit counts reconcile without declaring the HIGH finding closed", () => {
  const finding = evidence.securityDefiner;
  assert.equal(finding.anonCallable, 204);
  assert.equal(finding.repositoryExplicitAnonContractsPresent, 7);
  assert.equal(finding.anonCallableWithoutMatchedExplicitContract, 197);
  assert.equal(
    finding.repositoryExplicitAnonContractsPresent + finding.anonCallableWithoutMatchedExplicitContract,
    finding.anonCallable,
  );
  assert.match(evidence.status, /^OPEN_HIGH_/);
  assert.equal(evidence.notApplied, true);
  assert.equal(evidence.productionGo, false);
});

test("confirmed anonymous allowlist is exact and duplicate-free", () => {
  assert.equal(evidence.confirmedAnonAllowlist.length, 7);
  assert.equal(new Set(evidence.confirmedAnonAllowlist).size, 7);
});


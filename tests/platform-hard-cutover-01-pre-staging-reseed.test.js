import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESEED = path.join(
  ROOT,
  "docs/platform-hard-cutover-01/phase-04/sql/reseed"
);

const REQUIRED_FILES = [
  "00_ORDER_AND_SAFETY.md",
  "01_OWNER_TENANT_VERIFY_ONLY.sql",
  "02_CLUB.sql",
  "03_VENUE.sql",
  "04_COURTS.sql",
  "05_PLAYER.sql",
  "06_RATING_PROFILE.sql",
  "07_COMPETITION.sql",
  "08_PARTICIPANTS.sql",
  "09_SCHEDULE.sql",
  "10_MATCH.sql",
  "11_FINALIZED_RESULT.sql",
  "12_PUBLIC_CATALOG.sql",
  "13_CUSTOMER.sql",
  "14_CRM.sql",
  "15_FINANCE.sql",
  "16_NEWS.sql",
  "17_COACHING_FIRST_USE.sql",
  "99_VERIFY_RESEED.sql",
  "README.md",
];

test("reseed package: required files exist", () => {
  for (const name of REQUIRED_FILES) {
    assert.ok(existsSync(path.join(RESEED, name)), name);
  }
});

test("reseed package: no Auth user creation / no Owner UUID mutation language", () => {
  const files = readdirSync(RESEED).filter((f) => f.endsWith(".sql"));
  for (const name of files) {
    const text = readFileSync(path.join(RESEED, name), "utf8");
    assert.equal(
      /insert\s+into\s+auth\.users/i.test(text),
      false,
      `${name} must not INSERT auth.users`
    );
    assert.equal(
      /update\s+auth\.users/i.test(text),
      false,
      `${name} must not UPDATE auth.users`
    );
    assert.equal(
      /drop\s+table/i.test(text),
      false,
      `${name} must not DROP TABLE`
    );
  }
});

test("reseed package: finalize step forbids direct finalized_results invent as writer path", () => {
  const finalize = readFileSync(
    path.join(RESEED, "11_FINALIZED_RESULT.sql"),
    "utf8"
  );
  assert.match(finalize, /competition_ssot_finalize_match_result/);
  assert.match(finalize, /SINGLE WRITER|FORBIDDEN/i);
  assert.equal(
    /^\s*INSERT\s+INTO\s+public\.competition_ssot_finalized_results/im.test(
      finalize
    ),
    false
  );
});

test("reseed package: owner step is verify-only", () => {
  const owner = readFileSync(
    path.join(RESEED, "01_OWNER_TENANT_VERIFY_ONLY.sql"),
    "utf8"
  );
  assert.match(owner, /VERIFY ONLY|read-only/i);
  assert.equal(/INSERT\s+INTO/i.test(owner), false);
  assert.equal(/UPDATE\s+/i.test(owner), false);
  assert.equal(/DELETE\s+FROM/i.test(owner), false);
});

test("reseed package: idempotent seed key convention documented", () => {
  const order = readFileSync(path.join(RESEED, "00_ORDER_AND_SAFETY.md"), "utf8");
  assert.match(order, /hard-cutover-seed::/);
  assert.match(order, /No\*\* Auth user creation|No Auth user/i);
});

test("staging acceptance expansion doc present", () => {
  const p = path.join(
    ROOT,
    "docs/platform-hard-cutover-01/phase-04/staging-rehearsal/STAGING_ACCEPTANCE_EXPANDED.md"
  );
  assert.ok(existsSync(p));
  const text = readFileSync(p, "utf8");
  for (const token of [
    "A-OWN",
    "A-COACH",
    "A-MSG",
    "A-DASH",
    "ONE_CANONICAL_WRITER_PER_DOMAIN",
    "NO_HYBRID_RUNTIME",
  ]) {
    assert.match(text, new RegExp(token));
  }
});

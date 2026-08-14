import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PACKAGE_DIR = "docs/v5/migrations/daily-play-gender-normalizer-prerequisite-01";
const CLOSE_DIR = "docs/v5/migrations/daily-play-canonical-session-close-final-lifecycle-01";
const FILES = ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql", "README.md"];

function readPkg(name) {
  return fs.readFileSync(path.resolve(PACKAGE_DIR, name), "utf8");
}

function readClose(name) {
  return fs.readFileSync(path.resolve(CLOSE_DIR, name), "utf8");
}

describe("daily-play-gender-normalizer-prerequisite-01", () => {
  const precheck = readPkg("01_PRECHECK.sql");
  const apply = readPkg("02_APPLY.sql");
  const verify = readPkg("03_VERIFY.sql");
  const rollback = readPkg("04_ROLLBACK.sql");
  const readme = readPkg("README.md");

  test("package files exist", () => {
    for (const name of FILES) {
      assert.equal(fs.existsSync(path.resolve(PACKAGE_DIR, name)), true);
    }
  });

  test("APPLY creates only the gender normalizer helper", () => {
    const creates = apply.match(/CREATE OR REPLACE FUNCTION/gi) || [];
    assert.equal(creates.length, 1);
    assert.match(
      apply,
      /CREATE OR REPLACE FUNCTION public\.team_tournament_normalize_gender_key\(p_gender text\)/
    );
    assert.equal(apply.includes("team_tournament_resolve_player_gender_key"), false);
    assert.equal(apply.includes("team_tournament_resolve_player_status"), false);
    assert.equal(apply.includes("team_tournament_validate_lineup_selections"), false);
    assert.equal(apply.includes("daily_play_athlete_gender_key"), false);
    assert.equal(apply.includes("daily_play_close_session"), false);
    assert.equal(/\bCREATE TABLE\b/i.test(apply), false);
    assert.equal(/\bALTER TABLE\b/i.test(apply), false);
    assert.equal(/\bCREATE INDEX\b/i.test(apply), false);
    assert.equal(/\bCREATE UNIQUE INDEX\b/i.test(apply), false);
    assert.equal(/\bINSERT\s+INTO\b/i.test(apply), false);
    assert.equal(/\bUPDATE\s+public\./i.test(apply), false);
    assert.equal(/\bDELETE\s+FROM\b/i.test(apply), false);
  });

  test("helper is sql immutable with established aliases only", () => {
    assert.match(apply, /LANGUAGE sql/i);
    assert.match(apply, /IMMUTABLE/i);
    assert.match(apply, /SET search_path = public/i);
    assert.match(apply, /in \('nam', 'male', 'm'\) then 'male'/);
    assert.match(apply, /in \('nữ', 'nu', 'female', 'f', 'n'\) then 'female'/);
    assert.match(apply, /in \('other', 'khac', 'khác'\) then 'other'/);
    assert.match(apply, /else 'unknown'/);
    assert.equal(apply.includes("'boy'"), false);
    assert.equal(apply.includes("'man'"), false);
    assert.equal(apply.includes("'woman'"), false);
  });

  test("PRECHECK is read-only and fail-closed on semantic mismatch", () => {
    assert.match(precheck, /read-only/i);
    assert.match(precheck, /PRECHECK_PASS_MISSING_EXPECTED/);
    assert.match(precheck, /PRECHECK_PASS_ALREADY_COMPATIBLE/);
    assert.match(precheck, /PRECHECK_FAIL: male alias contract differs/);
    assert.equal(/\bCREATE OR REPLACE FUNCTION\b/i.test(precheck), false);
    assert.equal(/\bINSERT\s+INTO\b/i.test(precheck), false);
    assert.equal(/\bDROP FUNCTION\b/i.test(precheck), false);
  });

  test("VERIFY covers signature, immutability, and alias contract", () => {
    assert.match(verify, /Read-only/i);
    assert.match(verify, /expected sql/);
    assert.match(verify, /not IMMUTABLE/);
    assert.match(verify, /Nam expected male/);
    assert.match(verify, /male alias contract failed/);
    assert.match(verify, /female alias contract failed/);
    assert.match(verify, /other alias contract failed/);
    assert.match(verify, /unknown fail-closed contract failed/);
    assert.equal(/\bCREATE OR REPLACE FUNCTION\b/i.test(verify), false);
    assert.equal(/\bINSERT\s+INTO\b/i.test(verify), false);
  });

  test("ROLLBACK refuses DROP while dependents remain", () => {
    assert.match(rollback, /ROLLBACK_REFUSED/);
    assert.match(rollback, /dependent function/);
    assert.match(rollback, /After #424 is applied, this helper must not be dropped/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.team_tournament_normalize_gender_key\(text\)/);
    const dropIndex = rollback.indexOf("DROP FUNCTION IF EXISTS");
    const refuseIndex = rollback.indexOf("ROLLBACK_REFUSED: dependent function");
    assert.equal(refuseIndex >= 0 && dropIndex > refuseIndex, true);
  });

  test("#424 close package files are unchanged and still depend on the helper", () => {
    const closePre = readClose("01_PRECHECK.sql");
    const closeApply = readClose("02_APPLY.sql");
    const closeVerify = readClose("03_VERIFY.sql");
    const closeRollback = readClose("04_ROLLBACK.sql");
    assert.match(closePre, /team_tournament_normalize_gender_key\(text\)/);
    assert.match(closeApply, /SELECT public\.team_tournament_normalize_gender_key\(p\.gender\)/);
    assert.equal(closeApply.includes("daily-play-gender-normalizer-prerequisite-01"), false);
    assert.equal(closeVerify.includes("daily-play-gender-normalizer-prerequisite-01"), false);
    assert.equal(closeRollback.includes("daily-play-gender-normalizer-prerequisite-01"), false);
    assert.match(readme, /team_tournament_normalize_gender_key/);
    assert.match(readme, /does \*\*not\*\* install/i);
  });
});

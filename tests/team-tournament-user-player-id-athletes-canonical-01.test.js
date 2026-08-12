/**
 * Local-only package contract for athletes-canonical player helper.
 * Does not mutate Staging.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = join(
  __dirname,
  "../docs/v5/migrations/team-tournament-user-player-id-athletes-canonical-01"
);

function read(name) {
  return readFileSync(join(pkg, name), "utf8");
}

function sha256Lf(name) {
  const text = read(name).replace(/\r\n/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("team-tournament-user-player-id-athletes-canonical-01", () => {
  it("APPLY replaces profiles.player_id with athletes.id authority", () => {
    const apply = read("02_APPLY.sql");
    const verify = read("03_VERIFY.sql");
    const precheck = read("01_PRECHECK.sql");
    const rollback = read("04_ROLLBACK.sql");

    assert.match(precheck, /c168c14f87ad03a2a246150cd47afcf3/);
    assert.match(apply, /from public\.athletes a/);
    assert.match(apply, /a\.user_id = auth\.uid\(\)/);
    assert.doesNotMatch(apply, /p\.player_id/);
    assert.match(verify, /legacy profiles\.player_id authority still present/);
    assert.match(verify, /M01 helper got/);
    assert.match(verify, /M04 helper got/);
    assert.match(verify, /M05 helper got/);
    assert.match(verify, /unknown user must fail closed/);
    assert.match(verify, /M01 dashboard not authorized/);
    assert.match(verify, /M01 captain portal assert failed/);
    assert.match(verify, /save\/submit guard not authorized/);
    assert.match(verify, /referee list must not depend/);
    assert.match(rollback, /from public\.profiles p/);
    assert.match(rollback, /p\.player_id/);
    assert.match(rollback, /c168c14f87ad03a2a246150cd47afcf3/);
    assert.match(rollback, /E'\\r\\n  select coalesce/);
  });

  it("package files are present and non-empty", () => {
    for (const name of [
      "01_PRECHECK.sql",
      "02_APPLY.sql",
      "03_VERIFY.sql",
      "04_ROLLBACK.sql",
      "README.md",
    ]) {
      assert.ok(sha256Lf(name).length === 64, name);
    }
  });
});
